/**
 * Legal boilerplate (Recipe E). Engine-side templates filled from config — the
 * text is identical across every Detailer Systems client, only the variables move.
 *
 * NOTE: this is a business template, not legal advice. It should be reviewed by a
 * lawyer once, at the Detailer Systems level, and then reused unchanged.
 */
import type { SiteConfig } from '../config-schema';

export interface LegalSection {
  heading: string;
  /** Paragraphs. */
  body?: string[];
  /** Optional bullet list; `term` renders bold when present. */
  bullets?: Array<{ term?: string; text: string }>;
}

export interface LegalDocument {
  intro: string[];
  sections: LegalSection[];
  contact: { heading: string; intro: string };
}

/**
 * Closing contact block for an authored legal doc that omits one.
 *
 * The generator always produces this section, and LegalDoc.astro renders the phone /
 * email / website bullets under it either way, so an authored doc without one would
 * otherwise end abruptly on its last clause.
 */
export function defaultLegalContact(config: SiteConfig, docName: string): LegalDocument['contact'] {
  return {
    heading: 'Contact Us',
    intro: `For questions about this ${docName}, contact ${config.brand.name} at ${config.contact.email} or ${config.contact.phoneDisplay}.`,
  };
}

export function privacyPolicy(config: SiteConfig): LegalDocument {
  const { brand, contact, site } = config;

  return {
    intro: [
      `This Privacy Policy describes how ${brand.name} (${site.url}) collects, uses, and protects your personal information when you use our website or services.`,
      'We will never sell your personal information to third parties.',
    ],
    sections: [
      {
        heading: 'Information We Collect',
        body: ['We may collect the following types of information:'],
        bullets: [
          {
            term: 'Personal Information',
            text: 'Name, email address, phone number, and service address when you request a quote, book an appointment, or contact us.',
          },
          {
            term: 'Vehicle Information',
            text: 'Vehicle type, make, model, and condition details you provide when requesting a service.',
          },
          {
            term: 'Usage Data',
            text: 'Information about how you interact with our website, including pages visited, time spent, and links clicked.',
          },
          {
            term: 'Communication Records',
            text: 'Records of your communications with us via phone, email, or contact forms.',
          },
        ],
      },
      {
        heading: 'How We Use Your Information',
        body: ['We use the information we collect to:'],
        bullets: [
          { text: 'Provide and fulfill mobile detailing services' },
          { text: 'Respond to quotes, inquiries, and appointment requests' },
          { text: 'Send appointment confirmations and service reminders' },
          { text: 'Improve our website and services' },
          { text: 'Comply with legal obligations' },
        ],
      },
      {
        heading: 'Cookies',
        body: [
          'Our website may use cookies and similar tracking technologies to improve your browsing experience. You can control cookie settings through your browser. Disabling cookies may affect some website functionality.',
        ],
      },
      {
        heading: 'Third-Party Services',
        body: [
          'We may use third-party services for booking, payment processing, and communication, including GoHighLevel. These services have their own privacy policies, and we encourage you to review them.',
        ],
      },
      {
        heading: 'Data Security',
        body: [
          'We take reasonable steps to protect your personal information from unauthorized access, disclosure, or misuse.',
          'No internet transmission is completely secure, and we cannot guarantee absolute security.',
        ],
      },
      {
        heading: 'Your Rights',
        body: ['You have the right to:'],
        bullets: [
          { text: 'Request access to the personal information we hold about you' },
          { text: 'Request correction of inaccurate information' },
          { text: 'Request deletion of your personal information, subject to legal requirements' },
          { text: 'Opt out of marketing communications at any time' },
        ],
      },
      {
        heading: 'Limitation of Liability',
        body: [
          `${brand.name} is not liable for any indirect, incidental, or consequential damages arising from the use of our website or services. Our liability is limited to the maximum extent permitted by applicable law.`,
        ],
      },
      {
        heading: 'Changes to This Policy',
        body: [
          'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of our website after changes constitutes acceptance of the updated policy.',
        ],
      },
    ],
    contact: {
      heading: 'Contact Us',
      intro: `For questions about this Privacy Policy, or to exercise any of the rights above, contact us at ${contact.email}.`,
    },
  };
}

export function termsOfService(config: SiteConfig, serviceNames: string[]): LegalDocument {
  const { brand, contact, site, serviceArea } = config;
  const services =
    serviceNames.length > 1
      ? `${serviceNames.slice(0, -1).join(', ')} and ${serviceNames.at(-1)}`
      : (serviceNames[0] ?? 'mobile detailing');

  return {
    intro: [
      `These Terms of Service govern your use of ${site.url} and the mobile detailing services provided by ${brand.name}.`,
      'By using our website or booking our services, you agree to the following terms. Please read them carefully.',
    ],
    sections: [
      {
        heading: 'Acceptance of Terms',
        body: [
          'By using our website or booking our services, you agree to these Terms of Service. If you do not agree, please do not use our website or services.',
        ],
      },
      {
        heading: 'Services',
        body: [
          `${brand.name} provides ${services.toLowerCase()} services. All services are performed at the customer's location.`,
        ],
        bullets: [
          {
            term: 'Customer Requirements',
            text: 'Customers must provide access to a water supply and a standard power outlet at the service location. Failure to provide these may result in cancellation of the appointment.',
          },
          {
            term: 'Service Location',
            text: `${brand.name} serves ${serviceArea.baseCity}, ${serviceArea.baseState} and surrounding areas within a ${serviceArea.radiusMiles}-mile radius. Travel fees may apply for locations beyond this radius.`,
          },
        ],
      },
      {
        heading: 'Bookings and Cancellations',
        bullets: [
          {
            term: 'Scheduling',
            text: 'Appointments are confirmed upon agreement of date, time, and service type.',
          },
          {
            term: 'Cancellations',
            text: `We request reasonable advance notice for cancellations or rescheduling. Contact us at ${contact.phoneDisplay} as soon as possible.`,
          },
          {
            term: 'Final Pricing',
            text: 'Starting prices are quoted at booking. Final pricing may vary based on vehicle condition assessed upon arrival. Customers are informed of any price adjustment before work begins.',
          },
        ],
      },
      {
        heading: 'Payment',
        body: [
          'Payment is due upon completion of the service. We reserve the right to adjust pricing based on vehicle condition beyond what was described at booking. We will always communicate any adjustment before beginning work.',
          'Any price adjustment is always communicated to you before we begin work. No surprise fees added after the job is done.',
        ],
      },
      {
        heading: 'Limitation of Liability',
        body: [
          `${brand.name} takes care in performing all services. However, we are not liable for pre-existing damage to your vehicle, damage caused by the condition of the vehicle, or indirect or consequential damages arising from our services. Our liability is limited to the cost of the service performed.`,
        ],
      },
      {
        heading: 'Website Use',
        body: [
          'You agree to use our website only for lawful purposes. You may not attempt to gain unauthorized access to any part of our website or interfere with its operation.',
        ],
      },
      {
        heading: 'Intellectual Property',
        body: [
          `All content on ${site.url}, including text, images, and logos, is the property of ${brand.name} and may not be reproduced without permission.`,
        ],
      },
      {
        heading: 'Changes to Terms',
        body: [
          'We may update these Terms of Service at any time. Changes will be posted on this page with an updated date. Continued use of our website or services after changes constitutes acceptance of the updated terms.',
        ],
      },
    ],
    contact: {
      heading: 'Contact Us',
      intro: `For questions about these Terms of Service, contact us at ${contact.email} or ${contact.phoneDisplay}.`,
    },
  };
}
