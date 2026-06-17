'use client';

import React, { useState } from 'react';
import ReportsOverview from './ReportsOverview';
import ReportsList from './ReportsList';

export default function ReportsPage() {
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
        {subTab === 'overview' && <ReportsOverview />}
        {subTab === 'reports' && <ReportsList />}
      </div>
    </>
  );
}
