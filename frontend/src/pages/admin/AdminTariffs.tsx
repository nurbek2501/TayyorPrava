import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getErrorMessage, paymentMethodsApi, tariffsApi } from "@/lib/api";
import { useAdminMethods, useAdminTariffs } from "@/lib/queries";
import { cn, formatSom } from "@/lib/utils";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { toast } from "@/components/ui/toast";
import type { Tariff } from "@/lib/types";

interface Form {
  id?: string;
  title: string;
  durationDays: number;
  price: number;
  type: string;
  isActive: boolean;
}

const emptyForm: Form = {
  title: "",
  durationDays: 30,
  price: 0,
  type: "test_only",
  isActive: true,
};

export function AdminTariffs() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const tariffs = useAdminTariffs();
  const methods = useAdminMethods();
  const [form, setForm] = useState<Form | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["adminTariffs"] });
    qc.invalidateQueries({ queryKey: ["tariffs"] });
  };
  const invalidateMethods = () => {
    qc.invalidateQueries({ queryKey: ["adminMethods"] });
    qc.invalidateQueries({ queryKey: ["methods"] });
  };

  const saveMutation = useMutation({
    mutationFn: (f: Form) => (f.id ? tariffsApi.update(f.id, f) : tariffsApi.create(f)),
    onSuccess: () => {
      toast.success(t("common.save"));
      invalidate();
      setForm(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      tariffsApi.update(id, { isActive }),
    onSuccess: invalidate,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tariffsApi.remove(id),
    onSuccess: () => {
      toast.success(t("admin.questionDeleted"));
      invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleMethod = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      paymentMethodsApi.update(id, { isEnabled }),
    onSuccess: invalidateMethods,
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (tariffs.isLoading) return <PageLoader />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">{t("admin.tariffs")}</h1>
        <button onClick={() => setForm(emptyForm)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {t("admin.newTariff")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tariffs.data?.map((tariff) => (
          <div key={tariff.id} className="glass-card glass-hover p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold text-ink">{tariff.title}</div>
                <div className="text-xs text-muted">
                  {tariff.durationDays} kun · {tariff.type}
                </div>
              </div>
              <Toggle
                checked={tariff.isActive}
                onChange={(v) => toggleActive.mutate({ id: tariff.id, isActive: v })}
              />
            </div>
            <div className="mt-4 text-2xl font-extrabold text-accent">
              {formatSom(tariff.price)}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() =>
                  setForm({
                    id: tariff.id,
                    title: tariff.title,
                    durationDays: tariff.durationDays,
                    price: tariff.price,
                    type: tariff.type,
                    isActive: tariff.isActive,
                  })
                }
                className="btn-ghost flex-1"
              >
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </button>
              <button onClick={() => setDeleteTarget(tariff)} className="btn-ghost p-2.5 text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Payment methods */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-ink">{t("payment.methods")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {methods.data?.map((m) => (
            <div key={m.id} className="glass-card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="font-semibold text-ink">{m.name}</span>
              </div>
              <Toggle
                checked={m.isEnabled}
                onChange={(v) => toggleMethod.mutate({ id: m.id, isEnabled: v })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tariff form modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? t("common.edit") : t("admin.newTariff")}
      >
        {form && (
          <div className="space-y-3">
            <div>
              <label className="label">Nomi</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Muddat (kun)</label>
                <input
                  type="number"
                  className="input"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label">Narx (so'm)</label>
                <input
                  type="number"
                  className="input"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="label">Turi</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="test_only">Faqat test</option>
                <option value="full">To'liq</option>
              </select>
            </div>
            <label className="flex items-center justify-between rounded-xl bg-bg2/50 p-3">
              <span className="text-sm text-ink">{t("common.active")}</span>
              <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
            </label>
            <button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title.trim() || saveMutation.isPending}
              className={cn("btn-primary w-full")}
            >
              {saveMutation.isPending ? <Spinner /> : t("common.save")}
            </button>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={t("common.delete")}
        description={deleteTarget?.title}
        danger
        confirmText={t("common.yes")}
        cancelText={t("common.no")}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
