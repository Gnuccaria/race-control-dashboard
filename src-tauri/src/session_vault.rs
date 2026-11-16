//! Custodia del token di rinnovo di Discord nell'archivio sicuro del sistema operativo
//! (Gestione credenziali su Windows, Portachiavi su macOS, Secret Service su Linux).
//! È l'unico dato conservato, e solo se l'utente sceglie "Ricorda l'accesso".

use keyring::Entry;

const KEYRING_SERVICE: &str = "it.racecontroldashboard.desktop";
const KEYRING_ACCOUNT: &str = "discord-refresh-token";

fn refresh_token_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|keyring_error| keyring_error.to_string())
}

#[tauri::command]
pub fn read_refresh_token() -> Result<Option<String>, String> {
    match refresh_token_entry()?.get_password() {
        Ok(refresh_token) => Ok(Some(refresh_token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(keyring_error) => Err(keyring_error.to_string()),
    }
}

#[tauri::command]
pub fn save_refresh_token(refresh_token: String) -> Result<(), String> {
    refresh_token_entry()?
        .set_password(&refresh_token)
        .map_err(|keyring_error| keyring_error.to_string())
}

#[tauri::command]
pub fn delete_refresh_token() -> Result<(), String> {
    match refresh_token_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(keyring_error) => Err(keyring_error.to_string()),
    }
}
