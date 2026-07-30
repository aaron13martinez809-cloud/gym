export const metadata = {
  title: "Núcleo Gym",
  description: "Gestión de gimnasio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          background: "#17141B",
          color: "#EDE9F1",
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
