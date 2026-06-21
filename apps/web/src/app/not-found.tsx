'use client';

import Error from 'next/error';

export default function NotFound() {
  return (
    <html lang="vi">
      <body>
        <Error statusCode={404} />
      </body>
    </html>
  );
}
