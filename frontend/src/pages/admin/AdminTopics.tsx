import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, topicsApi } from "@/lib/api";
import { useTopics } from "@/lib/queries";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/toast";
import type { Topic } from "@/lib/types";

interface Form {
  id?: number;
  nameUz: string;
  nameKaa: string;
  nameRu: string;
  orderIndex: number;
}

const emptyForm: Form = { nameUz: "", nameKaa: "", nameRu: "", orderIndex: 0 };

export function AdminTopics() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: topics, isLoading } = useTopics();
  const [form, setForm] = useState<Form | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Topic | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["topics"] });

  const saveMutation = useMutation({
    mutationFn: (f: Form) =>
      f.id ? topicsApi.update(f.id, f) : topicsApi.create(f),
    onSuccess: () => {
      toast.success(t("common.save"));
      invalidate();
      setForm(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => topicsApi.remove(id),
    onSuccess: () => {
      toast.success(t("admin.questionDeleted"));
      invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.topics")}</h1>
        <button onClick={() => setForm(emptyForm)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t("common.add")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {topics?.map((tp) => (
          <div key={tp.id} className="glass-card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-bold text-accent">
              {tp.id}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-ink">{tp.nameUz}</div>
              <div className="truncate text-xs text-muted">{tp.questionCount} savol</div>
            </div>
            <button
              onClick={() =>
                setForm({
                  id: tp.id,
                  nameUz: tp.nameUz,
                  nameKaa: tp.nameKaa,
                  nameRu: tp.nameRu,
                  orderIndex: tp.orderIndex,
                })
              }
              className="btn-ghost p-2"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setDeleteTarget(tp)} className="btn-ghost p-2 text-danger">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t("common.edit") : t("common.add")}
      >
        {form && (
          <div className="space-y-3">
            <div>
              <label className="label">Nomi (O'zbekcha)</label>
              <input
                className="input"
                value={form.nameUz}
                onChange={(e) => setForm({ ...form, nameUz: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nomi (Qaraqalpaqsha)</label>
              <input
                className="input"
                value={form.nameKaa}
                onChange={(e) => setForm({ ...form, nameKaa: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nomi (Русский)</label>
              <input
                className="input"
                value={form.nameRu}
                onChange={(e) => setForm({ ...form, nameRu: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tartib</label>
              <input
                type="number"
                className="input"
                value={form.orderIndex}
                onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
              />
            </div>
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.nameUz.trim() || saveMutation.isPending}
              className="btn-primary w-full"
            >
              {saveMutation.isPending ? <Spinner /> : t("common.save")}
            </button>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={t("common.delete")}
        description={deleteTarget?.nameUz}
        danger
        confirmText={t("common.yes")}
        cancelText={t("common.no")}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
