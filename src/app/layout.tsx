import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agent Reliability Lab | Enterprise AI Architecture & Evaluation Workbench',
  description:
    'Evaluating whether an AI Application Architecture Review Agent is reliable enough for a defined enterprise task under explicit runtime, evidence, and human oversight conditions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 selection:bg-slate-900 selection:text-white">
        {children}
      </body>
    </html>
  );
}
