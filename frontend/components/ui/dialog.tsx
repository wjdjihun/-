'use client';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import type {ReactNode} from 'react';
export function Modal({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange:(v:boolean)=>void;title:string;description?:string;children:ReactNode}){
 return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay"/><Dialog.Content className="modal-content"><Dialog.Title className="modal-title">{title}</Dialog.Title><Dialog.Description className="modal-description">{description||'선택한 항목의 상세 정보를 확인하세요.'}</Dialog.Description><Dialog.Close className="modal-close" aria-label="닫기"><X size={20}/></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
