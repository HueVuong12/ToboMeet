// Root-level not-found — shown when no [locale] segment matches.
// Must NOT use next-intl hooks here (no locale context at root level).
export default function NotFound() {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          backgroundColor: '#f8fafc',
          color: '#0A2540',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '6rem', fontWeight: 800, lineHeight: 1, marginBottom: '1rem', color: '#0055FF' }}>
            404
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Trang không tồn tại
          </h1>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Page not found
          </p>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.5rem',
              backgroundColor: '#0055FF',
              color: 'white',
              borderRadius: '9999px',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            ← Về trang chủ
          </a>
        </div>
      </body>
    </html>
  );
}
