import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';

export default function Home() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('authToken');
      setHasToken(Boolean(token));
    } catch {
      setHasToken(false);
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">PM Job Search Engine</h1>
        <p className="text-lg text-gray-600 mb-6">AI-powered job search for Product Managers</p>
        <div className="flex items-center justify-center gap-3">
          {hasToken ? (
            <Button onClick={() => router.push('/dashboard')} className="bg-blue-600 text-white hover:bg-blue-700">
              Go to Dashboard
            </Button>
          ) : (
            <Link href="/login">
              <Button className="bg-blue-600 text-white hover:bg-blue-700">Sign In</Button>
            </Link>
          )}
          <Link href="/jobs">
            <Button variant="outline">View Jobs</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
