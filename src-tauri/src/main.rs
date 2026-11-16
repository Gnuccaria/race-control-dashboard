// Nelle build di release su Windows non apre la finestra della console.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    race_control_dashboard_lib::run()
}
