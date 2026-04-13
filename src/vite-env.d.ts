/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_SYNC_ADMIN_USER_ID?: string;
  /** Google reCAPTCHA v2 site key (public). Used on first-time Pick Six rules; secret is Edge RECAPTCHA_SECRET_KEY. */
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}
