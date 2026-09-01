import React, { useState, useRef } from 'react';
import { 
  FileDown, 
  FileUp, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  FileSpreadsheet, 
  FileCode, 
  Layers, 
  Check, 
  X,
  RefreshCw 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function ImportExportTab() {
  // Export states
  const [exportModule, setExportModule] = useState('repairs');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exporting, setExporting] = useState(false);

  // Import states
  const [importModule, setImportModule] = useState('inventory');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importItems, setImportItems] = useState<any[]>([]);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const modules = [
    { id: 'repairs', name: 'Repair Orders' },
    { id: 'customers', name: 'Customer Directory' },
    { id: 'inventory', name: 'Inventory & Parts' },
    { id: 'warranties', name: 'Battery Warranties' },
    { id: 'prices', name: 'Repair Price Matrix' },
    { id: 'attendance', name: 'Staff Attendance' },
    { id: 'damages', name: 'Damage Reports' },
    { id: 'couriers', name: 'Couriers & Dispatch' },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const res: any = await api.post('/admin/export', {
        module: exportModule,
        format: exportFormat,
      });

      if (res && res.success) {
        const data = res.data || [];
        let fileContent = '';
        let mimeType = '';
        let extension = '';

        if (exportFormat === 'json') {
          fileContent = JSON.stringify(data, null, 2);
          mimeType = 'application/json';
          extension = 'json';
        } else {
          // Convert array of objects to CSV
          if (data.length > 0) {
            const headers = Object.keys(data[0]);
            const rows = data.map((row: any) =>
              headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
            );
            fileContent = [headers.join(','), ...rows].join('\n');
          }
          mimeType = 'text/csv';
          extension = 'csv';
        }

        const blob = new Blob([fileContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MTS-${exportModule}-${new Date().toISOString().slice(0, 10)}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(`Exported ${res.count} records from ${exportModule} as ${exportFormat.toUpperCase()}!`);
      }
    } catch (err: any) {
      console.error('[EXPORT ERROR]', err);
      toast.error('Failed to export data.');
    } finally {
      setExporting(false);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] ?? '';
      });
      return obj;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setValidating(true);
    setPreviewResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: any[] = [];

        if (file.name.endsWith('.json')) {
          const parsedJson = JSON.parse(text);
          parsed = Array.isArray(parsedJson) ? parsedJson : (parsedJson.data || []);
        } else {
          parsed = parseCSV(text);
        }

        setImportItems(parsed);

        // Request server validation preview
        const res: any = await api.post('/admin/import/preview', {
          module: importModule,
          items: parsed,
        });

        if (res && res.success) {
          setPreviewResult(res);
        }
      } catch (err) {
        toast.error('Failed to parse import file.');
      } finally {
        setValidating(false);
      }
    };

    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!previewResult || !importItems.length) return;

    setImporting(true);
    try {
      const res: any = await api.post('/admin/import/execute', {
        module: importModule,
        items: importItems,
      });

      if (res && res.success) {
        toast.success(res.message || 'Data imported successfully!');
        setImportFile(null);
        setImportItems([]);
        setPreviewResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      toast.error(err.message || 'Import execution failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Export Card */}
        <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px] font-bold">
                DATA EXTRACTION
              </Badge>
            </div>
            <CardTitle className="text-xl font-black mt-2">Export Data Collections</CardTitle>
            <CardDescription className="text-slate-400 text-xs font-semibold">
              Extract clean tabular CSV or structured JSON records for external analysis or reporting.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Target Entity
              </label>
              <div className="grid grid-cols-2 gap-2">
                {modules.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setExportModule(m.id)}
                    className={`p-3 rounded-2xl text-left border text-xs font-bold transition-all cursor-pointer ${
                      exportModule === m.id
                        ? 'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-400/20'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Output Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportFormat('json')}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    exportFormat === 'json'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <FileCode className="h-5 w-5 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold text-xs">JSON Archive</div>
                    <div className="text-[10px] opacity-70">Complete nested objects</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setExportFormat('csv')}
                  className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all cursor-pointer ${
                    exportFormat === 'csv'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 shrink-0" />
                  <div className="text-left">
                    <div className="font-bold text-xs">Spreadsheet CSV</div>
                    <div className="text-[10px] opacity-70">Excel / Sheets compatible</div>
                  </div>
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="p-6 bg-slate-50 border-t border-slate-200/80 flex justify-end">
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-xs cursor-pointer"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1.5" />
                  Download {exportModule.toUpperCase()} ({exportFormat.toUpperCase()})
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Module Import Card */}
        <Card className="rounded-3xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
          <CardHeader className="p-6 bg-slate-900 text-white">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px] font-bold">
                BATCH INGESTION
              </Badge>
            </div>
            <CardTitle className="text-xl font-black mt-2">Import &amp; Ingest Records</CardTitle>
            <CardDescription className="text-slate-400 text-xs font-semibold">
              Ingest batches of records with automated schema validation and conflict detection.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                Target Import Module
              </label>
              <select
                value={importModule}
                onChange={(e) => {
                  setImportModule(e.target.value);
                  setPreviewResult(null);
                  setImportFile(null);
                }}
                className="w-full h-10 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold px-3 text-slate-800"
              >
                <option value="inventory">Parts &amp; Inventory Items</option>
                <option value="customers">Customers CRM</option>
                <option value="prices">Repair Price Matrix</option>
                <option value="attendance">Attendance Records</option>
                <option value="warranties">Battery Warranty Cards</option>
              </select>
            </div>

            {/* File Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-purple-400 bg-purple-50/20 hover:bg-purple-50/40 rounded-2xl p-6 text-center transition-colors cursor-pointer"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                {importFile ? importFile.name : 'Click to select CSV or JSON dataset'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Supports UTF-8 CSV and JSON object arrays.</p>
            </div>

            {/* Validation Preview Card */}
            {validating && (
              <div className="p-4 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                Validating schema and data types...
              </div>
            )}

            {previewResult && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[10px]">
                    Validation Report:
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      {previewResult.validCount} Valid
                    </Badge>
                    {previewResult.invalidCount > 0 && (
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                        {previewResult.invalidCount} Errors
                      </Badge>
                    )}
                  </div>
                </div>

                {previewResult.errors?.length > 0 && (
                  <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] font-semibold space-y-0.5">
                    {previewResult.errors.map((err: string, i: number) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="p-6 bg-slate-50 border-t border-slate-200/80 flex justify-end">
            <Button
              onClick={handleExecuteImport}
              disabled={importing || !previewResult || previewResult.validCount === 0}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-xs cursor-pointer"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Importing to Database...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1.5" />
                  Commit &amp; Ingest Valid Rows
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
