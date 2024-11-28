<?php
/*
Plugin Name: AI Auto Translator For WordPress Plugins
Description: AI Auto Translator For WordPress Plugins to translate your website content into any language.
Version: 1.0.0
License: GPL2
Text Domain: ai-auto-translator-for-wordpress-plugins
Domain Path: languages
Author: Cool Plugins
Author URI: https://coolplugins.net/
*/

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly
}

define( 'AITWP_FILE', __FILE__ );
define( 'AITWP_URL', plugin_dir_url( AITWP_FILE ) );
define( 'AITWP_PATH', plugin_dir_path( AITWP_FILE ) );
define( 'AITWP_VERSION', '1.0.0' );

/**
 * @package Ai Auto Translator For Wordpress
 * @version 1.0.0
 */

if ( ! class_exists( 'Ai_Auto_Trasnslator_For_Wordpress_Plugins' ) ) {

	/** Singleton ************************************/
	final class Ai_Auto_Trasnslator_For_Wordpress_Plugins {

		/**
		 * The unique instance of the plugin.
		 *
		 * @var Ai_Auto_Trasnslator_For_Wordpress_Plugins
		 */
		private static $instance;

		/**
		 * Gets an instance of plugin.
		 */
		public static function get_instance() {
			if ( null === self::$instance ) {
				self::$instance = new self();

				// register all hooks
				self::$instance->register();
			}

			return self::$instance;
		}

		/**
		 * Registers our plugin with WordPress.
		 */
		public static function register() {
			$thisPlugin = self::$instance;
			register_activation_hook( AITWP_FILE, array( $thisPlugin, 'aitwp_activate' ) );
			register_deactivation_hook( AITWP_FILE, array( $thisPlugin, 'aitwp_deactivate' ) );

			// run actions and filter only at admin end.
			if ( is_admin() ) {
				add_action( 'plugins_loaded', array( $thisPlugin, 'aitwp_check_required_loco_plugin' ) );
				// add notice to use latest loco translate addon
				add_action( 'init', array( $thisPlugin, 'aitwp_verify_loco_version' ) );

				add_action( 'admin_enqueue_scripts', array( $thisPlugin, 'aitwp_enqueue_scripts' ) );

				/* since version 2.1 */
				add_filter( 'loco_api_providers', array( $thisPlugin, 'aitwp_register_api' ), 10, 1 );
				add_action( 'loco_api_ajax', array( $thisPlugin, 'aitwp_ajax_init' ), 0, 0 );
				add_action( 'wp_ajax_save_all_translations', array( $thisPlugin, 'save_translations_handler' ) );
			}
		}

		/*
		|----------------------------------------------------------------------
		| Register API Manager inside Loco Translate Plugin
		|----------------------------------------------------------------------
		*/
		function aitwp_register_api( array $apis ) {
			$apis[] = array(
				'id'   => 'loco_auto',
				'key'  => '122343',
				'url'  => 'https://locoaddon.com/',
				'name' => 'Automatic Translate Addon',
			);
			return $apis;
		}

		/*
		|----------------------------------------------------------------------
		| Auto Translate Request handler
		|----------------------------------------------------------------------
		*/
		function aitwp_ajax_init() {
			 add_filter( 'loco_api_translate_loco_auto', array( self::$instance, 'loco_auto_translator_process_batch' ), 0, 3 );
		}

		/**
		 * Hook fired as a filter for the "loco_auto" translation api
		 *
		 * @param string[] input strings
		 * @param Loco_Locale target locale for translations
		 * @param array our own api configuration
		 * @return string[] output strings
		 */
		function loco_auto_translator_process_batch( array $sources, Loco_Locale $Locale, array $config ) {
			$targets = array();
			// Extract domain from the referrer URL
			$url_data   = self::$instance->aitwp_parse_query( $_SERVER['HTTP_REFERER'] );
			$domain     = isset( $url_data['domain'] ) && ! empty( $url_data['domain'] ) ? sanitize_text_field( $url_data['domain'] ) : 'temp';
			$lang       = sanitize_text_field( $Locale->lang );
			$region     = sanitize_text_field( $Locale->region );
			$project_id = $domain . '-' . $lang . '-' . $region;

			// Combine transient parts if available
			$allString = array();
			for ( $i = 0; $i <= 4; $i++ ) {
				$transient_part = get_transient( $project_id . '-part-' . $i );

				if ( ! empty( $transient_part ) ) {
					$allString = array_merge( $allString, $transient_part );
				}
			}
			if ( ! empty( $allString ) ) {
				foreach ( $sources as $i => $source ) {
					// Find the index of the source string in the cached strings
					$index = array_search( $source, array_column( $allString, 'source' ) );

					if ( is_numeric( $index ) && isset( $allString[ $index ]['target'] ) ) {
						$targets[ $i ] = sanitize_text_field( $allString[ $index ]['target'] );
					} else {
						$targets[ $i ] = '';
					}
				}
				return $targets;
			} else {
				throw new Loco_error_Exception( 'Please translate strings using the Auto Translate addon button first.' );
			}
		}

		function aitwp_parse_query( $var ) {
			/**
			 *  Use this function to parse out the query array element from
			 *  the output of parse_url().
			 */

			$var = parse_url( $var, PHP_URL_QUERY );
			$var = html_entity_decode( $var );
			$var = explode( '&', $var );
			$arr = array();

			foreach ( $var as $val ) {
				$x            = explode( '=', $val );
				if ( isset( $x[1] ) ) {
					$arr[ sanitize_text_field( $x[0] ) ] = sanitize_text_field( $x[1] );
				}
			}
			unset( $val, $x, $var );
			return $arr;
		}

		/*
		|----------------------------------------------------------------------
		| Save string translation inside cache for later use
		|----------------------------------------------------------------------
		*/
		// save translations inside transient cache for later use
		function save_translations_handler() {

			check_ajax_referer( 'loco-addon-nonces', 'wpnonce' );

			if ( isset( $_POST['data'] ) && ! empty( $_POST['data'] ) && isset( $_POST['part'] ) ) {

				$allStrings = json_decode( stripslashes( $_POST['data'] ), true );
				if ( empty( $allStrings ) ) {
					echo json_encode(
						array(
							'success' => false,
							'error'   => 'No data found in the request. Unable to save translations.',
						)
					);
					wp_die();
				}

				// Determine the project ID based on the loop value
				$projectId = $_POST['project-id'] . $_POST['part'];
				// Save the strings in transient with appropriate part value
				$rs = set_transient( $projectId, $allStrings, 5 * MINUTE_IN_SECONDS );
				echo json_encode(
					array(
						'success'  => true,
						'message'  => 'Translations successfully stored in the cache.',
						'response' => $rs == true ? 'saved' : 'cache already exists',
					)
				);

			} else {
				// Security check failed or missing parameters
				echo json_encode( array( 'error' => 'Invalid request. Missing required parameters.' ) );
			}
			wp_die();
		}

		/*
		|----------------------------------------------------------------------
		| check if required "Loco Translate" plugin is active
		| also register the plugin text domain
		|----------------------------------------------------------------------
		*/
		public function aitwp_check_required_loco_plugin() {
			if ( ! function_exists( 'loco_plugin_self' ) ) {
				add_action( 'admin_notices', array( self::$instance, 'aitwp_plugin_required_admin_notice' ) );
			}
			// load language files
			load_plugin_textdomain( 'ai-auto-translator-for-wordpress-plugins', false, basename( dirname( __FILE__ ) ) . '/languages/' );
		}
		/*
		|----------------------------------------------------------------------
		| Notice to 'Admin' if "Loco Translate" is not active
		|----------------------------------------------------------------------
		*/
		public function aitwp_plugin_required_admin_notice() {
			if ( current_user_can( 'activate_plugins' ) ) {
				$url         = 'plugin-install.php?tab=plugin-information&plugin=loco-translate&TB_iframe=true';
				$title       = 'Loco Translate';
				$plugin_info = get_plugin_data( __FILE__, true, true );
				echo '<div class="error"><p>' .
				sprintf(
					__(
						'In order to use <strong>%1$s</strong> plugin, please install and activate the latest version  of <a href="%2$s" class="thickbox" title="%3$s">%4$s</a>',
						'ai-auto-translator-for-wordpress-plugins'
					),
					esc_attr( $plugin_info['Name'] ),
					esc_url( $url ),
					esc_attr( $title ),
					esc_attr( $title )
				) . '.</p></div>';

				 deactivate_plugins( __FILE__ );
			}
		}

		/*
		|----------------------------------------------------------------------
		| check User Status
		|----------------------------------------------------------------------
		*/
		public function aitwp_verify_loco_version() {
			if ( function_exists( 'loco_plugin_version' ) ) {
				$locoV = loco_plugin_version();
				if ( version_compare( $locoV, '2.4.0', '<' ) ) {
					add_action( 'admin_notices', array( self::$instance, 'use_loco_latest_version_notice' ) );
				}
			}
		}
		/*
		|----------------------------------------------------------------------
		| Notice to use latest version of Loco Translate plugin
		|----------------------------------------------------------------------
		*/
		public function use_loco_latest_version_notice() {
			if ( current_user_can( 'activate_plugins' ) ) {
				$url         = 'plugin-install.php?tab=plugin-information&plugin=loco-translate&TB_iframe=true';
				$title       = 'Loco Translate';
				$plugin_info = get_plugin_data( __FILE__, true, true );
				echo '<div class="error"><p>' .
				sprintf(
					__(
						'In order to use <strong>%1$s</strong> (version <strong>%2$s</strong>), Please update <a href="%3$s" class="thickbox" title="%4$s">%5$s</a> official plugin to a latest version (2.4.0 or upper)',
						'ai-auto-translator-for-wordpress-plugins'
					),
					esc_attr( $plugin_info['Name'] ),
					esc_attr( $plugin_info['Version'] ),
					esc_url( $url ),
					esc_attr( $title ),
					esc_attr( $title )
				) . '.</p></div>';
			}
		}


		/*
		|------------------------------------------------------------------------
		|  Enqueue required JS file
		|------------------------------------------------------------------------
		*/
		function aitwp_enqueue_scripts( $hook ) {
			// load assets only on editor page
			if ( isset( $_REQUEST['action'] ) && $_REQUEST['action'] == 'file-edit' ) {
				wp_register_script( 'aitwp-local-ai-translator', AITWP_URL . 'assets/js/chrome-ai-translator.min.js', array(), AITWP_VERSION, true );
				wp_register_script( 'aitwp-common', AITWP_URL . 'assets/js/common.min.js', array( 'loco-translate-admin','aitwp-local-ai-translator' ), AITWP_VERSION, true );
				wp_register_script( 'aitwp-save-translation', AITWP_URL . 'assets/js/save-translation.min.js', array( 'aitwp-common' ), AITWP_VERSION, true );
				wp_register_style(
					'loco-addon-custom-css',
					AITWP_URL . 'assets/css/custom.min.css',
					null,
					AITWP_VERSION,
					'all'
				);

				wp_enqueue_script( 'aitwp-common' );
				wp_enqueue_script( 'aitwp-local-ai-translator' );
				wp_enqueue_script( 'aitwp-save-translation' );
				wp_enqueue_style( 'loco-addon-custom-css' );

				$extraData['ajax_url']        = admin_url( 'admin-ajax.php' );
				$extraData['nonce']           = wp_create_nonce( 'loco-addon-nonces' );
				$extraData['AITWP_URL']        = AITWP_URL;
				$extraData['preloader_path']  = 'preloader.gif';
				$extraData['extra_class']     = is_rtl() ? 'aitwp-rtl' : '';

				$extraData['loco_settings_url'] = admin_url( 'admin.php?page=loco-config&action=apis' );

				wp_localize_script( 'aitwp-common', 'aitwpData', $extraData );
				// copy object
				wp_add_inline_script(
					'loco-translate-admin',
					'
            var returnedTarget = JSON.parse(JSON.stringify(window.loco));
            window.locoConf=returnedTarget;'
		            );

			}
		}

		/*
		|------------------------------------------------------
		|    Plugin activation
		|------------------------------------------------------
		*/
		public function aitwp_activate() {
			update_option( 'aitwp-version', AITWP_VERSION );
			update_option( 'aitwp-installDate', gmdate( 'Y-m-d h:i:s' ) );
			update_option( 'aitwp-already-rated', 'no' );
			update_option( 'aitwp-type', 'free' );
		}

		/*
		|-------------------------------------------------------
		|    Plugin deactivation
		|-------------------------------------------------------
		*/
		public function aitwp_deactivate() {
			delete_option( 'aitwp-version' );
			delete_option( 'aitwp-installDate' );
			delete_option( 'aitwp-already-rated' );
			delete_option( 'aitwp-type' );
		}

		/**
		 * Throw error on object clone.
		 *
		 * The whole idea of the singleton design pattern is that there is a single
		 * object therefore, we don't want the object to be cloned.
		 */
		public function __clone() {
			// Cloning instances of the class is forbidden.
			_doing_it_wrong( __FUNCTION__, __( 'Cheatin&#8217; huh?', 'ai-auto-translator-for-wordpress-plugins' ), '2.3' );
		}

		/**
		 * Disable unserializing of the class.
		 */
		public function __wakeup() {
			// Unserializing instances of the class is forbidden.
			_doing_it_wrong( __FUNCTION__, __( 'Cheatin&#8217; huh?', 'ai-auto-translator-for-wordpress-plugins' ), '2.3' );
		}

	}

	function AITWP() {
		return Ai_Auto_Trasnslator_For_Wordpress_Plugins::get_instance();
	}
	AITWP();
}
