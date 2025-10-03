<?php
/*
Plugin Name: Firebase Sesiones (RTDB)
Description: Muestra tiempos de sesiones desde Firebase Realtime Database mediante shortcodes. Incluye login con Firebase Auth.
Version: 0.3.1
Author: Tu Nombre
*/

if ( ! defined('ABSPATH') ) exit;

function fs_enqueue_assets() {
  if ( wp_script_is('fs-app', 'enqueued') ) return;

  wp_enqueue_script(
    'fs-app',
    plugin_dir_url(__FILE__) . 'assets/app.js',
    array(),
    '0.3.1',
    true
  );

  wp_enqueue_style(
    'fs-style',
    plugin_dir_url(__FILE__) . 'assets/style.css',
    array(),
    '0.3.1'
  );
}

/**
 * Shortcode principal (listado + buscador + panel auth)
 * Uso: [firebase_sesiones]
 */
function fs_shortcode_sesiones($atts = array()) {
  fs_enqueue_assets();
  return '
  <div class="fs-wrapper fs-aggregado">
    <h2 class="fs-titulo">Inicio de Sesion</h2>

    <div id="fs-auth" class="fs-auth">
      <div class="fs-auth-status" id="fs-auth-status">Necesitas iniciar sesión para ver los datos.</div>
      <div class="fs-auth-actions" style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;">
        <input type="email" id="fs-email" class="fs-buscar" placeholder="Email" autocomplete="username" />
        <input type="password" id="fs-pass" class="fs-buscar" placeholder="Contraseña" autocomplete="current-password" />
        <button type="button" id="fs-login" class="fs-btn">Iniciar sesión</button>
        <button type="button" id="fs-logout" class="fs-btn fs-btn-outline" style="display:none">Cerrar sesión</button>
        <small id="fs-auth-error" style="color:#b00020;margin-left:.5rem;"></small>
      </div>
    </div>
    
  </div>';
}
add_shortcode('firebase_sesiones', 'fs_shortcode_sesiones');

/**
 * Shortcode detalle de un usuario específico
 * Uso: [firebase_sesiones_usuario usuario="Nicolas"]
 */
function fs_shortcode_sesiones_usuario($atts = array()) {
  fs_enqueue_assets();
  $a = shortcode_atts(array(
    'usuario' => '',
    'root'    => 'TiempoDuranteSesion'
  ), $atts);

  if ( empty($a['usuario']) ) {
    return '<div class="fs-wrapper fs-detalle-error">Falta atributo usuario.</div>';
  }

  $usuario = esc_attr($a['usuario']);
  $root    = esc_attr($a['root']);

  return '
  <div class="fs-wrapper fs-detalle">
    <h2 class="fs-titulo">Sesiones de '. $usuario .'</h2>

    <div id="fs-auth-detalle" class="fs-auth">
      <div class="fs-auth-status">Inicia sesión para ver el detalle.</div>
    </div>

    <div id="fs-detalle" class="fs-data" style="display:none" data-root="'. $root .'" data-user="'. $usuario .'">Cargando…</div>
  </div>';
}
add_shortcode('firebase_sesiones_usuario', 'fs_shortcode_sesiones_usuario');

/**
 * Shortcode solo lista (sin panel de login)
 * Uso: [firebase_sesiones_lista]
 */
function fs_shortcode_sesiones_lista($atts = array()) {
  fs_enqueue_assets();
  return '
  <div class="fs-wrapper fs-aggregado">
    <h2 class="fs-titulo">Resumen de Sesiones</h2>

    <div id="fs-data" class="fs-data">
      <div class="fs-busqueda-bar">
        <label for="fs-buscar-usuarios" class="fs-label">Buscar usuario:</label>
        <input type="text" id="fs-buscar-usuarios" class="fs-buscar" placeholder="Escribe para filtrar..." autocomplete="off" />
        <button type="button" class="fs-clear" aria-label="Limpiar búsqueda" title="Limpiar">×</button>
        <span class="fs-count" id="fs-count-usuarios"></span>
      </div>
      <div id="fs-usuarios" data-root="TiempoDuranteSesion">Cargando…</div>
    </div>
  </div>';
}
add_shortcode('firebase_sesiones_lista', 'fs_shortcode_sesiones_lista');
