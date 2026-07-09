/// 后台保活 — App 从后台恢复时通知前端立即轮询
///
/// Tauri 2 官方 background-fetch 插件尚未发布。
/// 此模块通过 RunEvent::Resumed 桥接原生 resume 事件到 JS 层：
///   Rust RunEvent::Resumed → window.emit("tauri:resume") → JS useBackgroundFetch._onTauriResume()
///
/// 等 Tauri 官方 background-fetch plugin 发布后：
///   1. 在 tauri.conf.json plugins 中添加 "background-fetch": {}
///   2. 在 Cargo.toml 中添加 tauri-plugin-background-fetch
///   3. 替换此模块为 plugin 调用

use tauri::{AppHandle, Emitter, Manager, RunEvent};

/// 注册 resume 事件处理器：App 从后台恢复时通知前端立即轮询
pub fn on_app_resume(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.emit("tauri:resume", ());
    }
}

/// 处理 RunEvent，目前仅处理 Resumed
pub fn handle_run_event(app_handle: &AppHandle, event: RunEvent) {
    match event {
        RunEvent::Resumed => {
            on_app_resume(app_handle);
        }
        _ => {}
    }
}
