import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { buildQueryParams, API_URL } from '../utils/apiHelper';

const FilterBar = ({ filters, setFilters, restrictedCampus }) => {
    const [options, setOptions] = useState({
        campuses: [],
        streams: [],
        testTypes: [],
        tests: [],
        topAll: []
    });
    const [students, setStudents] = useState([]);
    const [loadingFilters, setLoadingFilters] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Transform string array to { value, label } for React Select
    const toOptions = (arr) => {
        if (arr.length === 1 && arr[0] === "__ALL__") return []; // Should not happen in options list
        return arr.map(item => ({ value: item, label: item }));
    };

    // Helper to get current value for React Select from simple array in state
    const getValue = (field, currentOptions) => {
        const val = filters[field];
        if (!val || val.length === 0) return [];

        if (val.length === 1 && val[0] === "__ALL__") {
            return [{ value: "SELECT_ALL", label: "ALL SELECTED" }];
        }

        // For studentSearch, map IDs back to labels using the students list
        if (field === 'studentSearch') {
            return val.map(v => {
                const s = students.find(st => st.id.toString() === v.toString());
                return s ? { value: s.id, label: s.name } : { value: v, label: v };
            });
        }
        return val.map(v => ({ value: v, label: v }));
    };

    // Generic handler for React Select changes with "Select All" support
    const handleSelectChange = (field, selectedOptions, actionMeta) => {
        if (actionMeta.action === "select-option" && selectedOptions.some(opt => opt.value === "SELECT_ALL")) {
            // Select All clicked -> Use a special "ALL" marker or just clear to signify all in some contexts
            // For simplicity and backend compatibility, we'll keep the full list but only if it's reasonably small.
            // Actually, BETTER: Set it to a special "ALL" value that the API helper understands.
            setFilters(prev => ({ ...prev, [field]: ["__ALL__"] }));
        } else if (actionMeta.action === "deselect-option" && actionMeta.option && actionMeta.option.value === "SELECT_ALL") {
            // Deselect All clicked -> Clear all
            setFilters(prev => ({ ...prev, [field]: [] }));
        } else {
            // Normal selection
            const values = selectedOptions ? selectedOptions.map(opt => opt.value).filter(v => v !== 'SELECT_ALL') : [];
            // If the user manually selects everything, we could also convert to __ALL__ but let's keep it explicit for now
            setFilters(prev => ({ ...prev, [field]: values }));
        }
    };

    useEffect(() => {
        const fetchFilters = async () => {
            const paramsOptions = buildQueryParams({
                campus: filters.campus,
                stream: filters.stream,
                testType: filters.testType,
                test: filters.test
            });
            const urlOptions = `${API_URL}/api/filters?${paramsOptions.toString()}`;

            setLoadingFilters(true);
            try {
                const res = await fetch(urlOptions);
                const data = await res.json();

                setOptions({
                    campuses: data.campuses || [],
                    streams: data.streams || [],
                    testTypes: data.testTypes || [],
                    tests: data.tests || [],
                    topAll: data.topAll || []
                });

                // CASCADING RESET LOGIC: 
                setFilters(prev => {
                    const next = { ...prev };
                    let changed = false;

                    const validateField = (key, available) => {
                        const currentValues = prev[key];
                        if (!currentValues || currentValues.length === 0 || currentValues[0] === "__ALL__") return;

                        const filtered = currentValues.filter(v => available.includes(v));
                        if (filtered.length !== currentValues.length) {
                            next[key] = filtered;
                            changed = true;
                        }
                    };

                    validateField('stream', data.streams || []);
                    validateField('testType', data.testTypes || []);
                    validateField('test', data.tests || []);
                    validateField('topAll', data.topAll || []);

                    return changed ? next : prev;
                });
            } catch (err) {
                console.error("[FilterBar] Options Fetch Error:", err);
            } finally {
                setLoadingFilters(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchFilters();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [filters.campus, filters.stream, filters.testType, filters.test]);

    useEffect(() => {
        const fetchStudents = async () => {
            const filtersForStudents = { ...filters };
            delete filtersForStudents.studentSearch;

            const paramsStudents = buildQueryParams(filtersForStudents);
            const urlStudents = `${API_URL}/api/studentsByCampus?${paramsStudents.toString()}`;

            setLoadingStudents(true);
            try {
                const res = await fetch(urlStudents);
                const data = await res.json();
                setStudents(data);
            } catch (err) {
                console.error("[FilterBar] Students Fetch Error:", err);
            } finally {
                setLoadingStudents(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchStudents();
        }, 400); // slightly longer debounce for students list

        return () => clearTimeout(timeoutId);
    }, [filters.campus, filters.stream, filters.testType, filters.test, filters.topAll]);

    // Helper to wrap options with Select All
    const withSelectAll = (arr, labelPrefix = "Options") => [
        { value: "SELECT_ALL", label: `Select All ${labelPrefix}` },
        ...toOptions(arr)
    ];

    // Prepare Student Options with Select All
    const studentOptions = [
        { value: "SELECT_ALL", label: "Select All Students" },
        ...(students || []).map(s => ({ value: s.id, label: `${s.name} (${s.id})` }))
    ];

    // Check if "Select All" is active for a field
    const isSelectAllActive = (field) => {
        return filters[field] && filters[field].length === 1 && filters[field][0] === "__ALL__";
    };

    // Custom styles for React Select
    const customStyles = {
        control: (base, state) => ({
            ...base,
            background: 'white',
            borderColor: state.isFocused ? '#6366f1' : '#e2e8f0',
            minHeight: '38px',
            height: '38px', // Fixed height to prevent enlarging
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': {
                borderColor: '#6366f1'
            },
            overflow: 'hidden'
        }),
        menu: (base) => ({
            ...base,
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }),
        valueContainer: (base) => ({
            ...base,
            maxHeight: '38px',
            overflowX: 'auto',
            overflowY: 'hidden',
            flexWrap: 'nowrap',
            padding: '0 8px',
            scrollbarWidth: 'none', // Firefox
            '&::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
            maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
        }),

        placeholder: (base) => ({
            ...base,
            fontSize: '0.82rem',
            color: '#94a3b8',
            whiteSpace: 'nowrap'
        }),
        multiValue: (base, state) => {
            const isAll = state.data.value === 'SELECT_ALL';
            return {
                ...base,
                backgroundColor: isAll ? '#172554' : '#eff6ff',
                borderRadius: '4px',
                margin: '2px',
                minWidth: isAll ? '100px' : 'auto'
            };
        },
        multiValueLabel: (base, state) => ({
            ...base,
            color: state.data.value === 'SELECT_ALL' ? 'white' : '#1e40af',
            fontSize: '0.7rem',
            fontWeight: '700',
            padding: '2px 6px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            display: 'flex', // Always show remove button
            color: '#ef4444',
            ':hover': {
                backgroundColor: '#ef4444',
                color: 'white',
            },
        })
    };

    const resetFilters = () => {
        setFilters({
            campus: restrictedCampus ? [restrictedCampus] : [],
            stream: [],
            testType: [],
            test: [],
            topAll: [],
            studentSearch: []
        });
    };

    return (
        <div className="filter-bar">
            <div className={`filter-group campus-filter ${restrictedCampus ? 'disabled' : ''}`}>
                <label>Campus {restrictedCampus && <span style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>(Locked)</span>}</label>
                <Select
                    isMulti
                    name="campus"
                    options={withSelectAll(options.campuses, "Campuses")}
                    value={getValue('campus')}
                    onChange={(opts, meta) => handleSelectChange('campus', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingFilters}
                    classNamePrefix="react-select"
                    placeholder="Select Campus..."
                    styles={customStyles}
                    isDisabled={!!restrictedCampus}
                />
            </div>

            {/* Stream Select */}
            <div className={`filter-group ${loadingFilters || (!restrictedCampus && filters.campus.length === 0) ? 'disabled-logic' : ''}`}>
                <label>Stream</label>
                <Select
                    isMulti
                    name="stream"
                    options={withSelectAll(options.streams, "Streams")}
                    value={getValue('stream')}
                    onChange={(opts, meta) => handleSelectChange('stream', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingFilters}
                    classNamePrefix="react-select"
                    placeholder="Select Stream..."
                    styles={customStyles}
                    isDisabled={loadingFilters || (!restrictedCampus && filters.campus.length === 0)}
                />
            </div>

            {/* Test Type Select */}
            <div className={`filter-group ${loadingFilters || filters.stream.length === 0 ? 'disabled-logic' : ''}`}>
                <label>Test Type</label>
                <Select
                    isMulti
                    name="testType"
                    options={withSelectAll(options.testTypes, "Types")}
                    value={getValue('testType')}
                    onChange={(opts, meta) => handleSelectChange('testType', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingFilters}
                    classNamePrefix="react-select"
                    placeholder="Select Test Type..."
                    styles={customStyles}
                    isDisabled={loadingFilters || filters.stream.length === 0}
                />
            </div>

            {/* Test Select */}
            <div className={`filter-group ${loadingFilters || filters.testType.length === 0 ? 'disabled-logic' : ''}`}>
                <label>Test</label>
                <Select
                    isMulti
                    name="test"
                    options={withSelectAll(options.tests, "Tests")}
                    value={getValue('test')}
                    onChange={(opts, meta) => handleSelectChange('test', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingFilters}
                    classNamePrefix="react-select"
                    placeholder="Select Test..."
                    styles={customStyles}
                    isDisabled={loadingFilters || filters.testType.length === 0}
                />
            </div>

            {/* Top_ALL Select */}
            <div className={`filter-group ${loadingFilters || filters.test.length === 0 ? 'disabled-logic' : ''}`}>
                <label>Top_ALL</label>
                <Select
                    isMulti
                    name="topAll"
                    options={withSelectAll(options.topAll || [], "Top_ALL")}
                    value={getValue('topAll')}
                    onChange={(opts, meta) => handleSelectChange('topAll', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingFilters}
                    classNamePrefix="react-select"
                    placeholder="Select Top_ALL..."
                    styles={customStyles}
                    isDisabled={loadingFilters || filters.test.length === 0}
                />
            </div>

            {/* Student Name Select */}
            <div className={`filter-group wide-filter ${loadingStudents || filters.topAll.length === 0 ? 'disabled-logic' : ''}`}>
                <label>Student Name</label>
                <Select
                    isMulti
                    name="studentSearch"
                    options={studentOptions}
                    value={getValue('studentSearch')}
                    onChange={(opts, meta) => handleSelectChange('studentSearch', opts, meta)}
                    className="react-select-container"
                    isLoading={loadingStudents}
                    classNamePrefix="react-select"
                    placeholder="Select Students..."
                    styles={customStyles}
                    isDisabled={loadingStudents || filters.test.length === 0}
                />
            </div>

            <div className="filter-actions">
                <button
                    onClick={resetFilters}
                    className="btn-primary reset-btn"
                    style={{ backgroundColor: '#ef4444' }}
                >
                    Clear All
                </button>
            </div>
        </div>
    );
};

export default FilterBar;
