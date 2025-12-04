import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Users, FileCheck, CreditCard, FolderOpen } from 'lucide-react';

const MagicLineImport = () => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.zip')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Bitte wähle eine ZIP-Datei aus');
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Bitte wähle zuerst eine Datei aus');
      return;
    }

    setImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('zipFile', file);

    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch('/api/magicline-import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const contentType = response.headers.get('content-type');

      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server-Fehler: ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import fehlgeschlagen');
      }

      setImportResults(data.results);
      setFile(null);

    } catch (err) {
      setError(err.message);
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <FolderOpen className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">MagicLine Import</h1>
            <p className="text-gray-600">Importiere Mitglieder, Verträge und Dokumente aus MagicLine</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-2">So funktioniert der Import:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Exportiere deine Daten aus MagicLine als ZIP-Datei</li>
                <li>Lade die ZIP-Datei hier hoch</li>
                <li>Das System importiert automatisch:
                  <ul className="list-disc list-inside ml-6 mt-1">
                    <li>Mitgliederdaten (Name, Adresse, Geburtsdatum, etc.)</li>
                    <li>Vertragsdaten (Original-Startdatum, Laufzeit, Tarif)</li>
                    <li>SEPA-Mandate (Bankverbindung, Mandatsreferenz)</li>
                    <li>PDF-Dokumente (Verträge, SEPA-Mandate)</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            MagicLine Export (ZIP-Datei)
          </label>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                disabled={importing}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold
                hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                flex items-center gap-2 transition-colors"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Importiere...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Import starten
                </>
              )}
            </button>
          </div>

          {file && !importing && (
            <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              Datei ausgewählt: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 mb-3">
                <CheckCircle className="w-5 h-5" />
                <p className="font-semibold">Import erfolgreich abgeschlossen!</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-600">Mitglieder</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {importResults.successful} / {importResults.totalMembers}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-600">Verträge</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {importResults.logs.filter(l => l.imported?.contract).length}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-600">SEPA-Mandate</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {importResults.logs.filter(l => l.imported?.sepaMandate).length}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <FileCheck className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-600">Dokumente</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {importResults.logs.reduce((sum, l) => sum + (l.imported?.documents || 0), 0)}
                  </p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-600">Zahlungen</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {importResults.logs.reduce((sum, l) => sum + (l.imported?.payments || 0), 0)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mt-3">
                Dauer: {importResults.duration?.toFixed(1)} Sekunden
              </p>
            </div>

            {/* Import Log Details */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-3">Import-Details</h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {importResults.logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      log.success
                        ? 'bg-white border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className="font-medium text-gray-800">
                          {log.memberNumber}
                        </span>
                      </div>

                      <div className="flex gap-2 text-xs flex-wrap">
                        {log.imported?.member && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Mitglied</span>
                        )}
                        {log.imported?.contract && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">Vertrag</span>
                        )}
                        {log.imported?.sepaMandate && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">SEPA</span>
                        )}
                        {log.imported?.payments > 0 && (
                          <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">
                            {log.imported.payments} Zahl.
                          </span>
                        )}
                        {log.imported?.documents > 0 && (
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">
                            {log.imported.documents} Dok.
                          </span>
                        )}
                      </div>
                    </div>

                    {log.errors && log.errors.length > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        {log.errors.map((err, i) => (
                          <p key={i}>• {err}</p>
                        ))}
                      </div>
                    )}

                    {log.warnings && log.warnings.length > 0 && (
                      <div className="mt-2 text-sm text-yellow-600">
                        {log.warnings.map((warn, i) => (
                          <p key={i}>• {warn}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setImportResults(null)}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium
                hover:bg-gray-200 transition-colors"
            >
              Neuen Import starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MagicLineImport;
