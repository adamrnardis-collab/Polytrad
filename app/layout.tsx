import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PromptMirror - Generate Vibe-Coding Prompts',
  description: 'Turn any website into a detailed prompt for AI coding assistants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
