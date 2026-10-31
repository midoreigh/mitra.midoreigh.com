// schema.org JSON-LD for the home page: who made Mitra, what it is, where to get it, and the
// FAQ shown on the page. Only facts that are visible on the page go in here.

import type { Release } from './releases';
import { FAQ, FEATURES, SITE, plain } from './site';

export function structuredData(mac: Release, android: Release) {
  const page = `${SITE.url}/`;
  const app = `${SITE.url}/#app`;
  const author = `${SITE.author.url}/#person`;
  const screenshots = ['/og.png'].map((p) => new URL(p, SITE.url).href);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE.url}/#website`,
        url: page,
        name: SITE.name,
        description: SITE.description,
        inLanguage: 'en',
        publisher: { '@id': author },
      },
      {
        '@type': 'WebPage',
        '@id': `${page}#webpage`,
        url: page,
        name: SITE.title,
        description: SITE.description,
        isPartOf: { '@id': `${SITE.url}/#website` },
        about: { '@id': app },
        primaryImageOfPage: new URL('/og.png', SITE.url).href,
        inLanguage: 'en',
      },
      {
        '@type': 'Person',
        '@id': author,
        name: SITE.author.name,
        url: SITE.author.url,
        sameAs: ['https://github.com/midoreigh'],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': app,
        name: SITE.name,
        alternateName: 'Mitra',
        description: SITE.description,
        url: page,
        image: new URL('/icon.png', SITE.url).href,
        screenshot: screenshots,
        applicationCategory: 'UtilitiesApplication',
        applicationSubCategory: 'Smart home, air conditioner remote control',
        operatingSystem: 'macOS 26 or later, Android 8.0 or later',
        softwareVersion: `Mac ${mac.version}, Android ${android.version}`,
        dateModified: [mac.date, android.date].sort().at(-1),
        downloadUrl: [mac.download, android.download],
        installUrl: `${page}#download`,
        releaseNotes: [mac.page, android.page],
        featureList: FEATURES.map(([title, body]) => `${title}: ${body}`),
        isAccessibleForFree: true,
        license: 'https://opensource.org/license/mit',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
        author: { '@id': author },
        publisher: { '@id': author },
        sameAs: [SITE.repo],
        subjectOf: { '@type': 'BlogPosting', url: SITE.blogPost, headline: 'Mitra: Every Setting on My AC, One Tap Away' },
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${SITE.url}/#source`,
        name: `${SITE.name} source code`,
        codeRepository: SITE.repo,
        programmingLanguage: ['Swift', 'Kotlin'],
        license: 'https://opensource.org/license/mit',
        targetProduct: { '@id': app },
        author: { '@id': author },
      },
      {
        '@type': 'FAQPage',
        '@id': `${page}#faq`,
        mainEntity: FAQ.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: plain(a) },
        })),
      },
    ],
  };
}
