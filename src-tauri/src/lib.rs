mod discord_oauth_redirect;
mod session_vault;

/// Avvia la finestra desktop che ospita l'interfaccia React (cartella `dist`).
/// Il lato nativo fa solo ciò che il frontend non può fare da solo: aprire il browser
/// per il login con Discord, ricevere il ritorno, custodire il token in modo sicuro e
/// installare gli aggiornamenti dell'app (plugin updater e process).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            discord_oauth_redirect::authorize_in_browser,
            discord_oauth_redirect::cancel_browser_authorization,
            session_vault::read_refresh_token,
            session_vault::save_refresh_token,
            session_vault::delete_refresh_token,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione");
}
