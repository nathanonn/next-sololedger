"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template: {
    id: string;
    name: string;
  } | null;
  onDelete: (id: string) => Promise<void>;
}

export function DeleteTemplateDialog({
  isOpen,
  onClose,
  template,
  onDelete,
}: DeleteTemplateDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!template) return;

    setIsDeleting(true);
    try {
      await onDelete(template.id);
      onClose();
    } catch (error) {
      console.error("Delete error:", error);
    } finally {
      setIsDeleting(false);
    }
  }

  if (!template) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Template?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{template.name}&quot;? This
            action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
