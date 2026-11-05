"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type CustomSelectOption = {
  value: string;
  label: string;
};

export type CustomSelectProps = {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

export function CustomSelect({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  options,
  placeholder = "Pilih salah satu",
  className = "",
  disabled = false,
  size = "sm",
  ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: CustomSelectProps) {
  const generatedId = useId();
  const listId = id ? `${id}-listbox` : `select-${generatedId}-listbox`;

  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue ?? (options[0]?.value || ""),
  );
  const currentValue = isControlled ? controlledValue : internalValue;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((opt) => opt.value === currentValue);

  // Close when clicking outside
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

  function openDropdown() {
    if (disabled) return;
    const idx = options.findIndex((opt) => opt.value === currentValue);
    setHighlightedIndex(idx >= 0 ? idx : 0);
    setIsOpen(true);
  }

  function toggleDropdown() {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
    } else {
      openDropdown();
    }
  }

  function handleSelect(val: string) {
    if (!isControlled) {
      setInternalValue(val);
    }
    onChange?.(val);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!isOpen) {
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(
          (prev) => (prev - 1 + options.length) % options.length,
        );
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[highlightedIndex]) {
          handleSelect(options[highlightedIndex].value);
        }
        break;
      case "Escape":
      case "Tab":
        setIsOpen(false);
        break;
    }
  }

  const heightClass = size === "sm" ? "min-h-9 text-xs" : "min-h-10 text-sm";
  const paddingClass = size === "sm" ? "px-3 py-1.5" : "px-3.5 py-2";

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {name ? <input type="hidden" name={name} value={currentValue} /> : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        onClick={toggleDropdown}
        className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] ${paddingClass} ${heightClass} font-medium text-[var(--foreground)] shadow-2xs transition hover:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-[var(--muted-foreground)] transition-transform duration-150 ${
            isOpen ? "rotate-180 text-[var(--primary)]" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          className="absolute left-0 z-50 mt-1 max-h-60 w-full min-w-[170px] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg backdrop-blur-xs transition focus:outline-none"
        >
          {options.map((option, idx) => {
            const isSelected = option.value === currentValue;
            const isHighlighted = idx === highlightedIndex;

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition select-none ${
                  isSelected
                    ? "bg-[var(--primary-subtle)] font-bold text-[var(--primary)]"
                    : isHighlighted
                      ? "bg-[var(--sand)] text-[var(--foreground)]"
                      : "text-[var(--foreground)]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected ? (
                  <Check
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-[var(--primary)]"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
