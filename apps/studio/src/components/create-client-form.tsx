'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';

/**
 * The Create Client form.
 *
 * ⚠️ Class 1 under ADR-0057 D4 and human-initiated throughout. 🚫 No autosave:
 * unlike a discovery draft, a half-written record is read by everything
 * downstream as a real scope.
 *
 * 🚫 Nothing on this screen creates an organization. ADR-0058 D4 — there is no
 * tenant model, so the organization is a string the operator supplies and the
 * Organizations band on Businesses stays derived from it.
 */

export type CreateClientResult =
  | { readonly kind: 'created'; readonly clientId: string; readonly firstRecord: boolean }
  | { readonly kind: 'not-configured'; readonly variable: string }
  | { readonly kind: 'refused'; readonly reason: string; readonly field?: string };

export interface CreateClientFormProps {
  readonly create: (formData: FormData) => Promise<CreateClientResult>;
}

export function CreateClientForm({ create }: CreateClientFormProps) {
  const [result, setResult] = useState<CreateClientResult | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;

      setSubmitting(true);
      try {
        setResult(await create(new FormData(form)));
      } finally {
        setSubmitting(false);
      }
    },
    [create],
  );

  if (result?.kind === 'created') {
    return (
      <section className="mt-6 rounded border border-[hsl(var(--age-border))] p-4">
        <h2 className="text-sm font-semibold">Client created</h2>
        <p className="mt-2 text-sm text-[hsl(var(--age-text-muted))]">
          <span className="font-mono">{result.clientId}</span> was appended to your client record
          file.
          {result.firstRecord ? ' The record file did not exist yet and was created.' : null}
        </p>
        {/*
          ⚠️ Named plainly: creating a record is an identity, not knowledge.
          Nothing has been discovered, scored or captured for this business.
        */}
        <p className="mt-2 text-xs text-[hsl(var(--age-text-muted))]">
          Nothing is known about this business yet — a record carries its identity, not its facts.
          Discovery is where its facts are captured.
        </p>
        <p className="mt-4 flex gap-4 text-xs">
          <Link
            href={{ pathname: `/b/${result.clientId}/discovery` }}
            className="underline underline-offset-2"
          >
            Start Discovery
          </Link>
          <Link href={{ pathname: '/businesses' }} className="underline underline-offset-2">
            Back to Businesses
          </Link>
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-xl">
      <Field
        name="clientId"
        label="Client id"
        hint="Lowercase letters, digits, dots, dashes and underscores. It appears in the URL and names this business's files, so it cannot be changed later without moving them."
        result={result}
      />
      <Field
        name="displayName"
        label="Display name"
        hint="What you call this business. Used on screen only."
        result={result}
      />
      <Field
        name="organizationId"
        label="Organization id"
        hint="The scope every capability invocation carries. AGE will not infer one — type the same value for businesses that belong together, and they will group under it on the Businesses screen."
        result={result}
      />

      <div className="mt-5">
        <label htmlFor="externalRefsText" className="block text-sm">
          External references
          <span className="ml-2 text-xs text-[hsl(var(--age-text-muted))]">optional</span>
        </label>
        <textarea
          id="externalRefsText"
          name="externalRefsText"
          rows={3}
          placeholder="rankops = their-id-for-this-business"
          className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent p-2 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">
          One <span className="font-mono">key = value</span> per line: which peer product, and that
          product&rsquo;s own identifier for this business. Leave it empty if this business is not
          in any of them yet — that is an ordinary business, not an incomplete one.
        </p>
        {result?.kind === 'refused' && result.field === 'externalRefsText' ? (
          <p className="mt-1 text-xs text-[hsl(var(--age-unknown))]">{result.reason}</p>
        ) : null}
      </div>

      {/*
        ⚠️ Said on the screen, not just in an ADR: this creates an identity and
        nothing else. No organization is created, and no access is granted.
      */}
      <p className="mt-6 text-xs text-[hsl(var(--age-text-muted))]">
        This appends a record to your client record file and does nothing else. It does not create
        an organization, grant anyone access, contact any external system, or record anything about
        what the business does.
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 rounded border border-[hsl(var(--age-border))] px-3 py-1.5 text-sm disabled:opacity-40"
      >
        {submitting ? 'Creating…' : 'Create client'}
      </button>

      {result?.kind === 'not-configured' ? (
        <p className="mt-3 text-sm text-[hsl(var(--age-unknown))]">
          No client record file has been configured, so there is nowhere to write this. Set{' '}
          <code className="font-mono text-xs">{result.variable}</code> and restart the console.
        </p>
      ) : null}

      {result?.kind === 'refused' && result.field === undefined ? (
        <p className="mt-3 text-sm text-[hsl(var(--age-unknown))]">{result.reason}</p>
      ) : null}
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  result,
}: {
  readonly name: string;
  readonly label: string;
  readonly hint: string;
  readonly result: CreateClientResult | undefined;
}) {
  const refusal = result?.kind === 'refused' && result.field === name ? result.reason : undefined;

  return (
    <div className="mt-5">
      <label htmlFor={name} className="block text-sm">
        {label}
        <span className="ml-2 text-xs text-[hsl(var(--age-text-muted))]">required</span>
      </label>
      <input
        id={name}
        name={name}
        type="text"
        className="mt-1 w-full rounded border border-[hsl(var(--age-border))] bg-transparent p-2 font-mono text-sm"
      />
      <p className="mt-1 text-xs text-[hsl(var(--age-text-muted))]">{hint}</p>
      {refusal !== undefined ? (
        <p className="mt-1 text-xs text-[hsl(var(--age-unknown))]">{refusal}</p>
      ) : null}
    </div>
  );
}
