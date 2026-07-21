import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, questionsApi } from "@/lib/api";
import { CONTENT_LANGS } from "@/lib/lang";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import type { ContentLang, Topic } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  topics: Topic[];
  onSaved: () => void;
}

const empty = () => ({ kaa: "", uz: "", ru: "" });

interface OptForm {
  text: { kaa: string; uz: string; ru: string };
  isCorrect: boolean;
}

export function QuestionFormModal({ open, onClose, topics, onSaved }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [lang, setLang] = useState<ContentLang>("uz");
  const [topicId, setTopicId] = useState<number>(topics[0]?.id ?? 1);
  const [text, setText] = useState(empty());
  const [explanation, setExplanation] = useState(empty());
  const [options, setOptions] = useState<OptForm[]>([
    { text: empty(), isCorrect: true },
    { text: empty(), isCorrect: false },
  ]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setLang("uz");
    setText(empty());
    setExplanation(empty());
    setOptions([
      { text: empty(), isCorrect: true },
      { text: empty(), isCorrect: false },
    ]);
    setImageFile(null);
    setImagePreview(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const checkMutation = useMutation({
    mutationFn: () => questionsApi.check(text.uz.trim()),
    onSuccess: (res) => {
      if (res.exists) {
        toast.warning(t("admin.questionExists"));
      } else {
        setStep(2);
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const created = await questionsApi.create({
        topicId,
        text,
        explanation,
        options: options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
      });
      if (imageFile) {
        await questionsApi.uploadImage(created.id, imageFile);
      }
      return created;
    },
    onSuccess: () => {
      toast.success(t("admin.questionAdded"));
      onSaved();
      close();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const setOptText = (i: number, value: string) =>
    setOptions((opts) =>
      opts.map((o, idx) => (idx === i ? { ...o, text: { ...o.text, [lang]: value } } : o))
    );

  const setCorrect = (i: number) =>
    setOptions((opts) => opts.map((o, idx) => ({ ...o, isCorrect: idx === i })));

  const addOption = () =>
    options.length < 4 && setOptions((o) => [...o, { text: empty(), isCorrect: false }]);

  const removeOption = (i: number) =>
    options.length > 2 && setOptions((o) => o.filter((_, idx) => idx !== i));

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const canSave =
    text.uz.trim() &&
    options.filter((o) => o.text.uz.trim()).length >= 2 &&
    options.some((o) => o.isCorrect);

  return (
    <Modal open={open} onClose={close} title={t("admin.newQuestion")} className="max-w-2xl">
      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="label">{t("admin.topics")}</label>
            <select
              className="input"
              value={topicId}
              onChange={(e) => setTopicId(Number(e.target.value))}
            >
              {topics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.id}. {tp.nameUz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("admin.questionText")} (O'zbekcha)</label>
            <textarea
              className="input min-h-24"
              value={text.uz}
              onChange={(e) => setText((s) => ({ ...s, uz: e.target.value }))}
              placeholder="Savol matnini kiriting..."
            />
          </div>
          <button
            onClick={() => checkMutation.mutate()}
            disabled={!text.uz.trim() || checkMutation.isPending}
            className="btn-primary w-full"
          >
            {checkMutation.isPending ? <Spinner /> : t("common.check")}
          </button>
        </div>
      )}

      {/* Step 2 */}
      <AnimatePresence>
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-4 overflow-hidden"
          >
            {/* Language tabs */}
            <div className="flex gap-1 rounded-xl border border-line/15 bg-bg2/60 p-1">
              {CONTENT_LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    lang === l.code ? "bg-accent text-white" : "text-muted hover:text-ink"
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>

            <div>
              <label className="label">{t("admin.questionText")}</label>
              <textarea
                className="input min-h-20"
                value={text[lang]}
                onChange={(e) => setText((s) => ({ ...s, [lang]: e.target.value }))}
              />
            </div>

            <div>
              <label className="label">{t("admin.options")}</label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      onClick={() => setCorrect(i)}
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition",
                        opt.isCorrect
                          ? "border-success bg-success/20 text-success"
                          : "border-line/20 text-muted"
                      )}
                      title={t("admin.correctAnswer")}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <input
                      className="input"
                      value={opt.text[lang]}
                      onChange={(e) => setOptText(i, e.target.value)}
                      placeholder={`Variant ${i + 1}`}
                    />
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="btn-ghost p-2 text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 4 && (
                <button onClick={addOption} className="btn-ghost mt-2 text-sm">
                  <Plus className="h-4 w-4" />
                  {t("common.add")}
                </button>
              )}
            </div>

            <div>
              <label className="label">{t("admin.explanation")}</label>
              <textarea
                className="input min-h-16"
                value={explanation[lang]}
                onChange={(e) =>
                  setExplanation((s) => ({ ...s, [lang]: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="label">{t("admin.uploadImage")}</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line/25 bg-bg2/40 p-4 hover:border-accent/50">
                <input type="file" accept="image/*" hidden onChange={onImage} />
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <ImagePlus className="h-8 w-8 text-muted" />
                )}
                <span className="text-sm text-muted">
                  {imageFile ? imageFile.name : "Rasm tanlang (ixtiyoriy)"}
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep(1)} className="btn-ghost flex-1">
                {t("common.back")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!canSave || saveMutation.isPending}
                className="btn-primary flex-1"
              >
                {saveMutation.isPending ? <Spinner /> : t("common.save")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
