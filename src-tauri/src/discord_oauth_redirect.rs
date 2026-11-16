//! Login con Discord per un'app desktop (RFC 8252): apre il browser di sistema sulla pagina
//! di autorizzazione e attende il ritorno su un indirizzo locale (loopback).
//! Il codice ricevuto viene restituito al frontend, che completa lo scambio con PKCE.

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// Solo la pagina di autorizzazione ufficiale di Discord può essere aperta da questo comando.
const DISCORD_AUTHORIZE_URL_PREFIX: &str = "https://discord.com/oauth2/authorize?";
const REDIRECT_PATH: &str = "/discord/callback";
const LOGIN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const POLL_INTERVAL: Duration = Duration::from_millis(150);

static IS_AUTHORIZATION_CANCELLED: AtomicBool = AtomicBool::new(false);

/// Pagina mostrata nel browser a login concluso. Titolo e messaggio arrivano dal frontend,
/// già tradotti nella lingua dell'app, e vengono resi sicuri prima di inserirli nell'HTML.
fn completed_page(title: &str, message: &str) -> String {
    format!(
        r#"<!doctype html><html><meta charset="utf-8"><title>{title}</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0;background:#f1f3f2;color:#20262e">
<main style="text-align:center"><h1 style="font-weight:600">{title}</h1><p>{message}</p></main></body></html>"#,
        title = escape_html(title),
        message = escape_html(message),
    )
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Apre Discord nel browser e restituisce il percorso di ritorno (es. "/discord/callback?code=...&state=...").
/// Errori restituiti al frontend: LOGIN_TIMEOUT, LOGIN_CANCELLED, PORT_IN_USE, INVALID_AUTHORIZE_URL.
#[tauri::command]
pub async fn authorize_in_browser(
    window: tauri::Window,
    authorize_url: String,
    redirect_port: u16,
    completion_page_title: String,
    completion_page_message: String,
) -> Result<String, String> {
    if !authorize_url.starts_with(DISCORD_AUTHORIZE_URL_PREFIX) {
        return Err("INVALID_AUTHORIZE_URL".into());
    }

    let completion_page = completed_page(&completion_page_title, &completion_page_message);
    let redirect_target = tauri::async_runtime::spawn_blocking(move || {
        wait_for_redirect(&authorize_url, redirect_port, &completion_page)
    })
    .await
    .map_err(|join_error| join_error.to_string())??;

    // Riporta in primo piano la finestra dell'app dopo il passaggio dal browser.
    let _ = window.set_focus();
    Ok(redirect_target)
}

/// Interrompe un login in corso (pulsante "Annulla" nella schermata di accesso).
#[tauri::command]
pub fn cancel_browser_authorization() {
    IS_AUTHORIZATION_CANCELLED.store(true, Ordering::SeqCst);
}

fn wait_for_redirect(
    authorize_url: &str,
    redirect_port: u16,
    completion_page: &str,
) -> Result<String, String> {
    IS_AUTHORIZATION_CANCELLED.store(false, Ordering::SeqCst);

    // Il listener è attivo prima di aprire il browser: il ritorno non può andare perso.
    let listener =
        TcpListener::bind(("127.0.0.1", redirect_port)).map_err(|_| "PORT_IN_USE".to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|io_error| io_error.to_string())?;

    tauri_plugin_opener::open_url(authorize_url, None::<&str>)
        .map_err(|opener_error| opener_error.to_string())?;

    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        if IS_AUTHORIZATION_CANCELLED.load(Ordering::SeqCst) {
            return Err("LOGIN_CANCELLED".into());
        }
        if Instant::now() >= deadline {
            return Err("LOGIN_TIMEOUT".into());
        }

        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(redirect_target) = read_redirect_target(stream, completion_page) {
                    return Ok(redirect_target);
                }
            }
            Err(accept_error) if accept_error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(accept_error) => return Err(accept_error.to_string()),
        }
    }
}

/// Legge la prima riga della richiesta HTTP. Restituisce il percorso solo se è quello di ritorno;
/// le altre richieste (es. /favicon.ico) ricevono un 404 e l'attesa continua.
fn read_redirect_target(mut stream: TcpStream, completion_page: &str) -> Option<String> {
    stream.set_nonblocking(false).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;

    let mut request_line = String::new();
    BufReader::new(&stream).read_line(&mut request_line).ok()?;
    let request_target = request_line.split_whitespace().nth(1)?.to_string();

    if request_target.starts_with(REDIRECT_PATH) {
        write_response(&mut stream, "200 OK", completion_page);
        Some(request_target)
    } else {
        write_response(&mut stream, "404 Not Found", "");
        None
    }
}

fn write_response(stream: &mut TcpStream, status: &str, body: &str) {
    let _ = write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.flush();
}
