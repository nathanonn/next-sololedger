/**
 * Report Header Component
 * Server component for displaying organization branding on printed reports
 */

import type { OrgBranding } from "@/lib/reporting-branding";
import Image from "next/image";

interface ReportHeaderProps {
  branding: OrgBranding;
  reportTitle: string;
  periodDescription: string;
  baseCurrency: string;
}

export function ReportHeader({
  branding,
  reportTitle,
  periodDescription,
  baseCurrency,
}: ReportHeaderProps) {
  return (
    <div className="mb-8 border-b pb-6">
      {/* Logo and Business Name */}
      <div className="flex items-start gap-4 mb-4">
        {branding.logoUrl && (
          <div className="flex-shrink-0">
            <Image
              src={branding.logoUrl}
              alt={`${branding.displayName} logo`}
              width={80}
              height={80}
              className="object-contain"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {branding.displayName}
          </h1>
          {(branding.address || branding.email || branding.phone || branding.taxId) && (
            <div className="mt-2 text-sm text-gray-600 space-y-1">
              {branding.address && (
                <div className="whitespace-pre-line">{branding.address}</div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {branding.email && <div>Email: {branding.email}</div>}
                {branding.phone && <div>Phone: {branding.phone}</div>}
                {branding.taxId && <div>Tax ID: {branding.taxId}</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Title and Period */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold text-gray-900">{reportTitle}</h2>
        <div className="mt-2 text-sm text-gray-600 space-y-1">
          <div>Period: {periodDescription}</div>
          <div>Currency: {baseCurrency}</div>
        </div>
      </div>
    </div>
  );
}
