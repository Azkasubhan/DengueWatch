"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

export type CustomDatePickerProps = {
  id?: string;
  name?: string;
  value?: string; // Format: YYYY-MM-DD
  defaultValue?: string; // Format: YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAY_NAMES_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function formatIndonesianDate(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const monthName = MONTH_NAMES_ID[m - 1]?.slice(0, 3) ?? "";
  return `${String(d).padStart(2, "0")} ${monthName} ${y}`;
}

export function CustomDatePicker({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "Pilih tanggal",
  min,
  max,
  className = "",
  disabled = false,
  size = "sm",
  ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: CustomDatePickerProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue || "",
  );
  const currentValue = isControlled ? controlledValue || "" : internalValue;

  const [isOpen, setIsOpen] = useState(false);

  // Calendar navigation state (year & month, 0-indexed)
  const initialYearMonth = useMemo(() => {
    if (currentValue && /^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
      const [y, m] = currentValue.split("-").map(Number);
      if (y && m) return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [currentValue]);

  const [viewYear, setViewYear] = useState<number>(initialYearMonth.year);
  const [viewMonth, setViewMonth] = useState<number>(initialYearMonth.month);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  function openCalendar() {
    if (disabled) return;
    if (currentValue && /^\d{4}-\d{2}-\d{2}$/.test(currentValue)) {
      const [y, m] = currentValue.split("-").map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
    setIsOpen(true);
  }

  function toggleCalendar() {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      openCalendar();
    }
  }

  function prevMonth() {
    setViewMonth((curr) => {
      if (curr === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return curr - 1;
    });
  }

  function nextMonth() {
    setViewMonth((curr) => {
      if (curr === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return curr + 1;
    });
  }

  function handleSelectDate(day: number) {
    const formatted = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isControlled) {
      setInternalValue(formatted);
    }
    onChange?.(formatted);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isControlled) {
      setInternalValue("");
    }
    onChange?.("");
  }

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: Array<{
      day: number;
      dateString: string;
      isSelected: boolean;
      isToday: boolean;
      isDisabled: boolean;
    }> = [];

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (let d = 1; d <= daysInCurrentMonth; d += 1) {
      const dateString = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isSelected = dateString === currentValue;
      const isToday = dateString === todayStr;
      const isDisabled = Boolean(
        (min && dateString < min) || (max && dateString > max),
      );
      days.push({
        day: d,
        dateString,
        isSelected,
        isToday,
        isDisabled,
      });
    }

    return { firstDayIndex, days };
  }, [viewYear, viewMonth, currentValue, min, max]);

  const heightClass = size === "sm" ? "min-h-9 text-xs" : "min-h-10 text-sm";
  const paddingClass = size === "sm" ? "px-3 py-1.5" : "px-3.5 py-2";

  return (
    <div
      ref={containerRef}
      aria-invalid={ariaInvalid}
      className={`relative inline-block w-full text-left ${className}`}
    >
      {name ? (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          aria-invalid={ariaInvalid}
        />
      ) : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-expanded={isOpen}
        onClick={toggleCalendar}
        className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] ${paddingClass} ${heightClass} font-medium text-[var(--foreground)] shadow-2xs transition hover:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          <CalendarIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-[var(--primary)]"
          />
          <span className="truncate">
            {currentValue ? formatIndonesianDate(currentValue) : placeholder}
          </span>
        </span>

        {currentValue && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={handleClear}
            aria-label="Hapus tanggal"
            className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--danger)]"
          >
            <X aria-hidden="true" className="size-3.5" />
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Pilih tanggal"
          className="absolute left-0 z-50 mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg backdrop-blur-xs select-none animate-in fade-in-0 zoom-in-95"
        >
          {/* Month/Year Header */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Bulan sebelumnya"
              className="grid size-7 place-items-center rounded-lg text-[var(--foreground)] hover:bg-[var(--sand)]"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>

            <span className="text-xs font-bold text-[var(--foreground)]">
              {MONTH_NAMES_ID[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Bulan berikutnya"
              className="grid size-7 place-items-center rounded-lg text-[var(--foreground)] hover:bg-[var(--sand)]"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>

          {/* Days of Week Row */}
          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--muted-foreground)]">
            {DAY_NAMES_ID.map((day) => (
              <span key={day} className="py-0.5">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: calendarDays.firstDayIndex }).map(
              (_, idx) => (
                <div key={`empty-${idx}`} aria-hidden="true" />
              ),
            )}

            {calendarDays.days.map((item) => (
              <button
                key={item.dateString}
                type="button"
                disabled={item.isDisabled}
                onClick={() => handleSelectDate(item.day)}
                className={`relative flex size-7 items-center justify-center rounded-lg text-xs font-medium transition ${
                  item.isSelected
                    ? "bg-[var(--primary)] text-white font-bold shadow-2xs"
                    : item.isToday
                      ? "border border-[var(--primary)] text-[var(--primary)] font-bold hover:bg-[var(--primary-subtle)]"
                      : "text-[var(--foreground)] hover:bg-[var(--sand)]"
                } ${item.isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span>{item.day}</span>
              </button>
            ))}
          </div>

          {/* Today Button Footer */}
          <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                handleSelectDate(now.getDate());
                setViewYear(now.getFullYear());
                setViewMonth(now.getMonth());
              }}
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              Hari ini
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
