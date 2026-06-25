import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { verifyAccess } from '@/api/githubClient';
import type { AppCredentials } from '@/types/auth';

export default function SetupPage() {
  const { credentials, setCredentials } = useAuth();
  const navigate = useNavigate();

  const [owner, setOwner] = useState(credentials?.githubOwner ?? '');
  const [repo, setRepo] = useState(credentials?.githubRepo ?? '');
  const [branch, setBranch] = useState(credentials?.githubBranch ?? 'main');
  const [token, setToken] = useState(credentials?.githubToken ?? '');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!owner.trim() || !repo.trim() || !token.trim()) {
      setError('Owner, repo, and token are all required.');
      return;
    }

    const creds: AppCredentials = {
      githubToken: token.trim(),
      githubOwner: owner.trim(),
      githubRepo: repo.trim(),
      githubBranch: branch.trim() || 'main',
    };

    setChecking(true);
    const result = await verifyAccess(creds);
    setChecking(false);

    if (!result.ok) {
      setError(result.reason);
      return;
    }

    setCredentials(creds);
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-ink-200 p-8 shadow-xl">
        <h1 className="text-xl font-bold text-ink-700 mb-1">Connect your GitHub repo</h1>
        <p className="text-ink-500 text-sm mb-6">
          One-time setup for this browser. This token will be used for everyone (mentor + students)
          on this device — see the security note below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Repository owner" value={owner} onChange={setOwner} placeholder="e.g. rahul-sharma" />
          <Field label="Repository name" value={repo} onChange={setRepo} placeholder="e.g. cat-mentor-data" />
          <Field label="Branch" value={branch} onChange={setBranch} placeholder="main" />
          <Field
            label="GitHub Personal Access Token"
            value={token}
            onChange={setToken}
            placeholder="ghp_..."
            type="password"
          />

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={checking}
            className="w-full bg-catblue-500 hover:bg-catblue-600 disabled:opacity-50 text-white font-semibold rounded-md py-2.5 transition-colors"
          >
            {checking ? 'Checking access…' : 'Connect & Continue'}
          </button>
        </form>

        <details className="mt-6 text-xs text-ink-400">
          <summary className="cursor-pointer hover:text-ink-200">How do I create a token?</summary>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens</li>
            <li>Generate a new token scoped to only this repository</li>
            <li>Grant "Contents" permission: Read and write</li>
            <li>Copy the token here — it's stored only in this browser's local storage</li>
          </ol>
        </details>

        <p className="mt-4 text-xs text-ink-500 leading-relaxed">
          <strong className="text-ink-400">Security note:</strong> everyone using this app on this
          device shares this one token. There's no per-student password — anyone with access to this
          browser (or who knows the token) can act as any student or the mentor. This is intended for
          a small, trusted group only.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink-500 mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-ink-600 rounded-md px-3 py-2 text-ink-700 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-catblue-500"
      />
    </label>
  );
}
