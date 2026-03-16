import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Upload, FileUp, Loader2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

interface CsvColumn {
  header: string;
  sampleValues: string[];
}

interface FieldMapping {
  csvColumn: string;
  dbField: string;
}

interface CsvUploadDialogProps {
  /** Label shown on trigger button */
  label?: string;
  /** DB fields the user can map to */
  targetFields: { value: string; label: string }[];
  /** Required DB fields */
  requiredFields: string[];
  /** Called with parsed & mapped rows ready to insert */
  onImport: (rows: Record<string, string>[]) => Promise<void>;
}

export function CsvUploadDialog({ label = "Importer CSV", targetFields, requiredFields, onImport }: CsvUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setCsvColumns([]);
    setRawRows([]);
    setMappings([]);
    setImporting(false);
  };

  const parseCsv = (text: string): { headers: string[]; rows: string[][] } => {
    // Support both ; and , as delimiter
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error("Le fichier doit contenir au moins un en-tête et une ligne de données");
    
    const delimiter = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows = lines.slice(1).map((line) =>
      line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""))
    );
    return { headers, rows };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Format invalide", description: "Veuillez sélectionner un fichier .csv", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCsv(text);
        
        const columns: CsvColumn[] = headers.map((h, i) => ({
          header: h,
          sampleValues: rows.slice(0, 3).map((r) => r[i] || ""),
        }));

        setCsvColumns(columns);
        setRawRows(rows);

        // Auto-map by matching header names
        const autoMappings: FieldMapping[] = columns.map((col) => {
          const match = targetFields.find(
            (f) => f.value.toLowerCase() === col.header.toLowerCase() || f.label.toLowerCase() === col.header.toLowerCase()
          );
          return { csvColumn: col.header, dbField: match?.value || "_skip" };
        });
        setMappings(autoMappings);
        setStep("map");
      } catch (err: any) {
        toast({ title: "Erreur de lecture", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const updateMapping = (csvColumn: string, dbField: string) => {
    setMappings((prev) => prev.map((m) => (m.csvColumn === csvColumn ? { ...m, dbField } : m)));
  };

  const getMappedRows = (): Record<string, string>[] => {
    const activeMappings = mappings.filter((m) => m.dbField !== "_skip");
    return rawRows.map((row) => {
      const obj: Record<string, string> = {};
      activeMappings.forEach((m) => {
        const colIndex = csvColumns.findIndex((c) => c.header === m.csvColumn);
        if (colIndex >= 0) obj[m.dbField] = row[colIndex] || "";
      });
      return obj;
    }).filter((row) => Object.values(row).some((v) => v.trim()));
  };

  const missingRequired = () => {
    const mapped = mappings.filter((m) => m.dbField !== "_skip").map((m) => m.dbField);
    return requiredFields.filter((f) => !mapped.includes(f));
  };

  const handleGoPreview = () => {
    const missing = missingRequired();
    if (missing.length > 0) {
      const labels = missing.map((f) => targetFields.find((t) => t.value === f)?.label || f);
      toast({ title: "Champs requis manquants", description: labels.join(", "), variant: "destructive" });
      return;
    }
    setStep("preview");
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const rows = getMappedRows();
      if (rows.length === 0) {
        toast({ title: "Aucune donnée", description: "Le fichier ne contient pas de lignes valides", variant: "destructive" });
        setImporting(false);
        return;
      }
      await onImport(rows);
      toast({ title: "Import réussi", description: `${rows.length} lignes importées` });
      setOpen(false);
      reset();
    } catch (err: any) {
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
    }
    setImporting(false);
  };

  const previewRows = step === "preview" ? getMappedRows().slice(0, 5) : [];
  const previewFields = mappings.filter((m) => m.dbField !== "_skip");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="mr-2 h-4 w-4" />{label}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Importer un fichier CSV"}
            {step === "map" && "Mapper les colonnes"}
            {step === "preview" && "Aperçu avant import"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
              <FileUp className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cliquez pour sélectionner un fichier CSV</p>
              <p className="text-xs text-muted-foreground">Délimiteur : virgule (,) ou point-virgule (;)</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{rawRows.length} lignes détectées. Associez chaque colonne CSV à un champ.</p>
            <div className="space-y-3">
              {csvColumns.map((col) => {
                const mapping = mappings.find((m) => m.csvColumn === col.header);
                return (
                  <div key={col.header} className="flex items-center gap-3">
                    <div className="w-1/3">
                      <Label className="text-xs font-medium">{col.header}</Label>
                      <p className="text-xs text-muted-foreground truncate">{col.sampleValues.filter(Boolean).join(", ") || "—"}</p>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mapping?.dbField || "_skip"} onValueChange={(v) => updateMapping(col.header, v)}>
                      <SelectTrigger className="w-1/2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">— Ignorer —</SelectItem>
                        {targetFields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
            {missingRequired().length > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Champs requis non mappés : {missingRequired().map((f) => targetFields.find((t) => t.value === f)?.label || f).join(", ")}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { reset(); }}>Annuler</Button>
              <Button onClick={handleGoPreview}>Suivant</Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Aperçu des 5 premières lignes sur {getMappedRows().length} total.</p>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewFields.map((m) => (
                      <TableHead key={m.dbField}>{targetFields.find((f) => f.value === m.dbField)?.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {previewFields.map((m) => (
                        <TableCell key={m.dbField} className="text-sm">{row[m.dbField] || "—"}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>Retour</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Importer {getMappedRows().length} lignes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
