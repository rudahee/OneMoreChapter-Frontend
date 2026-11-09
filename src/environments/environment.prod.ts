export const environment = {
  production: true,
  // En móvil no hay origen propio, así que la URL absoluta es obligatoria:
  // las rutas relativas resolverían contra https://localhost del WebView.
  apiUrl: 'https://uncapitulomas.steelcode.team',
};
