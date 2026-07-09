mod background;

/// 桌面端启动（Windows / macOS / Linux）
#[cfg(not(mobile))]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .build(tauri::generate_context!())
        .expect("启动失败")
        .run(|app_handle, event| {
            background::handle_run_event(app_handle, event);
        });
}

/// 移动端启动（Android / iOS，含扫码插件 + resume 桥接）
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(mobile)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_barcode_scanner::init())
        .build(tauri::generate_context!())
        .expect("启动失败")
        .run(|app_handle, event| {
            background::handle_run_event(app_handle, event);
        });
}
