export const metadata = { title: "ReviewAgent", description: "Agente IA para reseñas de restaurantes" };
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, padding: 0, background: "#0f1117" }}>{children}</body>
    </html>
  );
}