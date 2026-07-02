'use client';

import React, { useState } from 'react';
import ReportsOverview from './ReportsOverview';
import ReportsList from './ReportsList';
import type { BrokerFilter, SegmentFilter } from '@/lib/engine/trade-filters';

interface Props {
  brokerFilter?: BrokerFilter;
  segmentFilter?: SegmentFilter[];
}

export default function ReportsPage({ brokerFilter = 'all', segmentFilter = ['all'] }: Props) {
  const [subTab, setSubTab] = useState<'overview' | 'reports'>('overview');

  return (
    <>
      <div className="journal-subtabs fade-in-up">
        <div
          className={`journal-subtab ${subTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSubTab('overview')}
        >
          Overview
        </div>
        <div
          className={`journal-subtab ${subTab === 'reports' ? 'active' : ''}`}
          onClick={() => setSubTab('reports')}
        >
          Reports
        </div>
      </div>

      <div className="fade-in-up">
        {subTab === 'overview' && <ReportsOverview brokerFilter={brokerFilter} segmentFilter={segmentFilter} />}
        {subTab === 'reports' && <ReportsList brokerFilter={brokerFilter} segmentFilter={segmentFilter} />}
      </div>
    </>
  );
}
