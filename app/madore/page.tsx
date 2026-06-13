'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME: Message = {
  role: 'assistant',
  content: "Bonjour et bienvenue chez **GP-CARS** ! 👋\n\nJe suis MADORE, votre conseiller en ligne. Je suis là pour vous aider à trouver le véhicule qui vous correspond vraiment.\n\nPour commencer — quel type de véhicule recherchez-vous ?",
};

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  // Simple markdown: bold (**text**), newlines
  const formatted = msg.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 mr-2 mt-1">
          M
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-white text-black rounded-tr-sm'
            : 'bg-zinc-800 text-zinc-100 rounded-tl-sm'
        }`}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    </div>
  );
}

// Wrapped in Suspense because useSearchParams() requires it in Next.js 14 App Router.
export default function MadorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <MadoreChat />
    </Suspense>
  );
}

function MadoreChat() {
  const params = useSearchParams();
  const demo = params.get('demo') === 'true' || params.get('demo') === '1';

  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    const assistantMsg: Message = { role: 'assistant', content: '' };
    setMessages([...history, assistantMsg]);

    try {
      const res = await fetch('/api/madore/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, demo }),
      });

      if (!res.body) throw new Error('No body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: full }]);
      }
    } catch {
      setMessages([
        ...history,
        { role: 'assistant', content: 'Désolé, une erreur est survenue. Veuillez réessayer.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // Hide RAPPORT MADORE block from display (internal use only)
  const displayMessages = messages.map((m) => ({
    ...m,
    content: m.content.replace(/# RAPPORT MADORE[\s\S]*/i, '').trim(),
  })).filter((m) => m.content.length > 0 || m.role === 'user');

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">

      {/* Banner mode test */}
      {demo && (
        <div className="bg-yellow-950 border-b border-yellow-800 px-4 py-2 text-center">
          <p className="text-yellow-300 text-xs font-semibold">
            ⚙️ MODE TEST — Les conversations ne sont pas sauvegardées. Utilisez ce mode pour entraîner et vérifier MADORE.
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center">
          <span className="text-black font-bold text-sm">GP</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">GP-CARS</p>
          <p className="text-xs text-green-400">MADORE · Conseiller en ligne</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">
        {displayMessages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0 mr-2 mt-1">M</div>
            <div className="bg-zinc-800 px-4 py-3 rounded-2xl rounded-tl-sm">
              <span className="text-zinc-400 text-sm animate-pulse">MADORE rédige…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Écrivez votre message…"
            rows={1}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none focus:ring-1 focus:ring-zinc-500 max-h-32"
            style={{ fieldSizing: 'content' } as React.CSSProperties}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-white text-black text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-zinc-200 transition-colors shrink-0"
          >
            Envoyer
          </button>
        </div>
        <p className="text-center text-xs text-zinc-600 mt-2">
          GP-CARS · Soumagne · MADORE ne prend jamais de décisions à votre place
        </p>
      </div>
    </div>
  );
}
