import { ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Suggestion {
  key: string;
  label: ReactNode;
  hint?: ReactNode;
  value: string;
}

export function CommandBar({
  value,
  onChange,
  onSubmit,
  placeholder,
  busy,
  cta,
  suggest,
  inputLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder: string;
  busy?: boolean;
  cta: string;
  suggest?: (q: string) => Suggestion[];
  inputLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => (suggest && value.trim() ? suggest(value) : []), [suggest, value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (v: string) => {
    setOpen(false);
    onSubmit(v);
  };

  return (
    <form
      className="command"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (open && items[active]) {
          onChange(items[active].value);
          submit(items[active].value);
        } else submit(value);
      }}
    >
      <div className="command-field">
        <MagnifyingGlass size={18} weight="light" color="var(--text-3)" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          aria-label={inputLabel}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls="command-suggestions"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {!value && <span className="kbd" aria-hidden>/</span>}
        <button className="cta" type="submit" disabled={busy}>
          {cta}
          <span className="cta-icon">{busy ? <span className="spinner" /> : <ArrowRight size={15} weight="bold" />}</span>
        </button>
      </div>
      {open && items.length > 0 && (
        <div className="suggestions" id="command-suggestions" role="listbox">
          {items.map((s, i) => (
            <button
              type="button"
              key={s.key}
              role="option"
              aria-selected={i === active}
              className="suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s.value);
                submit(s.value);
              }}
            >
              <span>{s.label}</span>
              {s.hint && <span className="formula">{s.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
