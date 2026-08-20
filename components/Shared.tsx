
import React, { useState, useEffect } from 'react';

export const Spinner: React.FC<{ size?: string; color?: string }> = ({ 
  size = "w-5 h-5", 
  color = "border-white" 
}) => (
  <div className={`${size} border-2 ${color} border-t-transparent rounded-full animate-spin`}></div>
);

interface CurrencyInputProps {
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const ConfirmDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}> = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'تایید', cancelText = 'انصراف', isDestructive = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 m-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
              <i className={`fas ${isDestructive ? 'fa-exclamation-triangle' : 'fa-info-circle'} text-xl`}></i>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-sm ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const convertToEnglishDigits = (str: string): string => {
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianDigits[i], i.toString()).replace(arabicDigits[i], i.toString());
  }
  return result;
};

export const CurrencyInput: React.FC<CurrencyInputProps> = ({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  required 
}) => {
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    if (value === '' || value === null || value === undefined) {
      setDisplayValue('');
    } else {
      const numValue = typeof value === 'string' ? parseInt(value) : value;
      if (!isNaN(numValue)) {
        setDisplayValue(numValue.toLocaleString());
      }
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // First, convert any Persian/Arabic digits to English digits
    let input = convertToEnglishDigits(e.target.value);
    
    // Then, remove all non-digit characters
    const rawInput = input.replace(/[^0-9]/g, '');
    
    if (rawInput === '') {
      setDisplayValue('');
      onChange('');
    } else {
      const num = parseInt(rawInput, 10);
      setDisplayValue(num.toLocaleString());
      onChange(rawInput);
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${className} pl-12 text-left ltr font-mono focus:ring-2 focus:ring-blue-500 transition-all`}
        style={{ direction: 'ltr' }}
        required={required}
      />
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-xs font-bold pointer-events-none">تومان</span>
    </div>
  );
};
