import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';

export type FieldInfo =
  | { name: string; type: 'text'; value: string; multiline: boolean; readOnly: boolean }
  | { name: string; type: 'checkbox'; value: boolean; readOnly: boolean }
  | { name: string; type: 'choice'; value: string; options: string[]; readOnly: boolean };

/** Liest die ausfüllbaren Felder eines PDFs mit ihren aktuellen Werten. */
export async function readFormFields(bytes: Uint8Array): Promise<FieldInfo[]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const out: FieldInfo[] = [];
  for (const field of doc.getForm().getFields()) {
    const name = field.getName();
    const readOnly = field.isReadOnly();
    if (field instanceof PDFTextField) {
      out.push({
        name,
        type: 'text',
        value: field.getText() ?? '',
        multiline: field.isMultiline(),
        readOnly,
      });
    } else if (field instanceof PDFCheckBox) {
      out.push({ name, type: 'checkbox', value: field.isChecked(), readOnly });
    } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
      out.push({
        name,
        type: 'choice',
        value: field.getSelected()[0] ?? '',
        options: field.getOptions(),
        readOnly,
      });
    } else if (field instanceof PDFRadioGroup) {
      out.push({
        name,
        type: 'choice',
        value: field.getSelected() ?? '',
        options: field.getOptions(),
        readOnly,
      });
    }
    // Schaltflächen und Signaturfelder haben keinen Wert zum Ausfüllen.
  }
  return out;
}
