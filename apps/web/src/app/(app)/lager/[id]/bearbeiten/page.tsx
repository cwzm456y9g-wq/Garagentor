'use client';

import { use } from 'react';
import { ErrorState, LoadingState, PageHeader } from '@/components/ui';
import { useApi } from '@/lib/hooks';
import type { Article } from '@/lib/types';
import { ArticleForm } from '../../artikel-form';

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<Article>(`/articles/${id}`);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Artikel bearbeiten"
        subtitle={data ? `${data.articleNumber} · ${data.name}` : undefined}
      />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <ArticleForm artikel={data} />
      )}
    </div>
  );
}
