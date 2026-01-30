import React, { useState, useRef, useEffect } from 'react';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder, isMulti = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (option) => {
        if (isMulti) {
            let newSelected;
            if (selected.includes(option)) {
                newSelected = selected.filter(item => item !== option);
            } else {
                newSelected = [...selected, option];
            }
            onChange(newSelected.length ? newSelected : []);
        } else {
            onChange(option);
            setIsOpen(false);
        }
    };

    const displayText = () => {
        if (Array.isArray(selected)) {
            if (selected.length === 0) return placeholder;
            if (selected.length === 1) return selected[0];
            return `${selected.length} Selected`;
        }
        return selected === 'All' ? placeholder : selected;
    };

    return (
        <div className="custom-dropdown" ref={dropdownRef}>
            <div className={`dropdown-header ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
                <span>{displayText()}</span>
                <span className="arrow">▼</span>
            </div>
            {isOpen && (
                <div className="dropdown-options">
                    {!isMulti && (
                        <div
                            className={`dropdown-option ${selected === 'All' ? 'selected' : ''}`}
                            onClick={() => handleSelect('All')}
                        >
                            {placeholder}
                        </div>
                    )}
                    {options.map((option, idx) => (
                        <div
                            key={idx}
                            className={`dropdown-option ${Array.isArray(selected) ? selected.includes(option) ? 'selected' : '' : selected === option ? 'selected' : ''}`}
                            onClick={() => handleSelect(option)}
                        >
                            {isMulti && (
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option)}
                                    readOnly
                                    style={{ marginRight: '8px', pointerEvents: 'none' }}
                                />
                            )}
                            {option}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;
