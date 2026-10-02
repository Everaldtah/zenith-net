import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Raw HTML is never rendered (react-markdown escapes it) and unsafe URL schemes are stripped.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="post-body text-[15px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => <a href={href} target="_blank" rel="nofollow noopener noreferrer ugc">{children}</a>,
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => (typeof src === 'string' && src.startsWith('https://') ? <img src={src} alt={alt ?? ''} loading="lazy" /> : null),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
