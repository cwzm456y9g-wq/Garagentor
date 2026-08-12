'use client';

import { PageHeader } from '@/components/ui';
import { ArticleForm } from '../artikel-form';

export default function NewArticlePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Artikel anlegen"
        subtitle="Die Artikelnummer wird automatisch vergeben. Auch Leistungen wie Montagestunden gehören hierher – dann ohne Bestandsführung."
      />
      <ArticleForm />
    </div>
  );
}
