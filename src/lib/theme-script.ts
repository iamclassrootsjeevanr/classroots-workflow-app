/** Runs inline in <head> before first paint: resolves theme "system" to the device setting. */
export const THEME_SCRIPT =
  "(function(){try{var d=document.documentElement;if(d.dataset.themePref==='system'){d.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}})();";
