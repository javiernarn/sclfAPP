import React, { useMemo } from 'react';
import ComboBox from './ComboBox';
import LiveMatchPreview from './LiveMatchPreview';
import {
    CATEGORY_NAMES, colorOptions, itemsFor, brandsFor, modelsFor, traitsFor, placeOptions,
    hasBrand, hasModel, findCategory, draftDescription, attributesFor,
    reconcileOnCategoryChange, reconcileOnItemChange, reconcileOnBrandChange,
} from '../../config/lostFoundCatalog';
import './ItemReportFields.css';

const toLocalISO = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
};

/**
 * The linked item fields shared by "Report a Found Item" and "Report a Lost Item".
 *
 *   Category → Item name → Brand → Model      (each narrows the next one's suggestions)
 *   Color                                      (shared palette, with swatches)
 *   Description / Unique characteristics       (drafted from the picks / tap-to-add ideas)
 *   Place / Date                               (places likely for this kind of item first)
 *
 * Every box accepts typed text when the list has no match.
 */
export default function ItemReportFields({ kind, form, setForm, fieldErrors = {}, clearError = () => {} }) {
    const isFound = kind === 'found';
    const placeField = isFound ? 'location_found' : 'location_lost';
    const dateField = isFound ? 'date_found' : 'date_lost';

    const cat = findCategory(form.category);
    const items = useMemo(() => itemsFor(form.category), [form.category]);
    const brands = useMemo(() => brandsFor(form.category, form.item_name), [form.category, form.item_name]);
    const models = useMemo(() => modelsFor(form.category, form.brand, form.item_name), [form.category, form.brand, form.item_name]);
    const attrs = useMemo(() => attributesFor(form.category, form.item_name), [form.category, form.item_name]);
    const traits = useMemo(() => traitsFor(form.category), [form.category]);
    const places = useMemo(() => placeOptions(form.category), [form.category]);

    const showBrand = hasBrand(form.category);
    const showModel = showBrand && hasModel(form.category);

    const set = (updater, fieldName) => {
        setForm((prev) => updater(prev));
        if (fieldName) clearError(fieldName);
    };
    const setField = (name) => (value) => set((p) => ({ ...p, [name]: value }), name);

    const today = toLocalISO(new Date());
    const yesterday = toLocalISO(new Date(Date.now() - 86400000));

    const draft = draftDescription(form);
    const canDraft = !form.description.trim() && (form.item_name || form.brand || form.color || form.model);

    const hasTrait = (t) => form.unique_characteristics.toLowerCase().includes(t.toLowerCase());
    const addTrait = (t) => set((p) => {
        if (p.unique_characteristics.toLowerCase().includes(t.toLowerCase())) return p;
        const base = p.unique_characteristics.trim().replace(/[,;]$/, '');
        const next = base ? `${base}, ${t}` : t;
        return { ...p, unique_characteristics: next.slice(0, 500) };
    }, 'unique_characteristics');

    return (
        <>
            <div className="ds-form-row ds-form-row-2">
                <div className="ds-field">
                    <label htmlFor="category">Category</label>
                    <ComboBox id="category" name="category" value={form.category}
                        onChange={(v) => set((p) => reconcileOnCategoryChange(p, v), 'category')}
                        options={CATEGORY_NAMES} placeholder="Pick one or type your own" />
                    <p className="ds-field-hint">Start here — the item, brand, model, color notes and usual places below adapt to your choice.</p>
                </div>
                <div className="ds-field">
                    <label htmlFor="item_name">Item Name <span className="ds-required">*</span></label>
                    <ComboBox id="item_name" name="item_name" value={form.item_name} required
                        invalid={!!fieldErrors.item_name} maxLength={255}
                        onChange={(v) => set((p) => reconcileOnItemChange(p, v), 'item_name')}
                        options={items}
                        placeholder={cat ? 'Pick an item or type it' : 'e.g. Umbrella (or pick a category first)'}
                        emptyText="Pick a category for ideas — or just type the item." />
                    <p className="ds-field-hint">
                        {isFound
                            ? 'A short, specific name for what you found — this is what owners will see when searching.'
                            : 'A short, specific name — this is what shows up in search and in match results.'}
                    </p>
                    {fieldErrors.item_name && <div className="ds-field-error">{fieldErrors.item_name}</div>}
                </div>
            </div>

            {(showBrand || showModel) && (
                <div className="ds-form-row ds-form-row-2">
                    {showBrand && (
                        <div className="ds-field">
                            <label htmlFor="brand">{cat?.brandLabel || 'Brand'}</label>
                            <ComboBox id="brand" name="brand" value={form.brand}
                                onChange={(v) => set((p) => reconcileOnBrandChange(p, v), 'brand')}
                                options={brands} placeholder="Pick a brand or type it"
                                emptyText="Pick a category / item for brand ideas — or type it." />
                            <p className="ds-field-hint">
                                {form.item_name && brands.length
                                    ? `Common brands for “${form.item_name}”. Choose “No brand” if it's unbranded.`
                                    : 'Leave blank if you\'re not sure.'}
                            </p>
                        </div>
                    )}
                    {showModel && (
                        <div className="ds-field">
                            <label htmlFor="model">{cat?.modelLabel || 'Model'}</label>
                            <ComboBox id="model" name="model" value={form.model}
                                onChange={setField('model')} options={models}
                                placeholder={models.length ? 'Pick a model or type it' : (cat?.modelHint || 'e.g. Model XR-200')}
                                emptyText="Type the model printed on the item." />
                            <p className="ds-field-hint">
                                {models.length
                                    ? `${models.length} ${form.brand} models${form.item_name ? ` for “${form.item_name}”` : ''} — pick yours or type it.`
                                    : 'Only if it\'s printed on the item or its packaging — optional.'}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="ds-form-row ds-form-row-2">
                <div className="ds-field">
                    <label htmlFor="color">Color</label>
                    <ComboBox id="color" name="color" value={form.color} onChange={setField('color')}
                        options={colorOptions} placeholder="Pick the main color or type it" />
                    <p className="ds-field-hint">Main color — the single biggest clue for matching.</p>
                </div>
                <div className="ds-field irf-spacer" aria-hidden="true" />
            </div>

            <div className="ds-field">
                <label htmlFor="description">Description <span className="ds-required">*</span></label>
                <textarea id="description" name="description" rows={4} value={form.description}
                    onChange={(e) => set((p) => ({ ...p, description: e.target.value }), 'description')}
                    placeholder="Color, brand, distinguishing marks, contents…"
                    aria-invalid={!!fieldErrors.description} autoComplete="off" required />
                {canDraft && (
                    <button type="button" className="irf-chip irf-draft"
                        onClick={() => set((p) => ({ ...p, description: `${draft}. ` }), 'description')}>
                        ✎ Start with: “{draft}.”
                    </button>
                )}
                <p className="ds-field-hint">
                    {isFound
                        ? 'Describe only what\'s visible from the outside — Security will ask claimants to name details you leave out, which is how they verify the real owner.'
                        : 'The more specific you are here, the better our matching engine — and Security — can confirm it\'s really yours.'}
                </p>
                {fieldErrors.description && <div className="ds-field-error">{fieldErrors.description}</div>}
            </div>

            <div className="ds-field">
                <label htmlFor="unique_characteristics">Unique Characteristics</label>
                <input id="unique_characteristics" name="unique_characteristics" maxLength={500}
                    value={form.unique_characteristics}
                    onChange={(e) => set((p) => ({ ...p, unique_characteristics: e.target.value }), 'unique_characteristics')}
                    placeholder={isFound ? 'Scratches, stickers, engravings…' : 'What only you would know — stickers, scratches, name written inside…'}
                    autoComplete="off" />
                {traits.length > 0 && (
                    <div className="irf-chips" aria-label="Ideas for unique characteristics">
                        {traits.map((t) => (
                            <button key={t} type="button" className={`irf-chip${hasTrait(t) ? ' is-on' : ''}`}
                                onClick={() => addTrait(t)} disabled={hasTrait(t)}>
                                {hasTrait(t) ? '✓ ' : '+ '}{t}
                            </button>
                        ))}
                    </div>
                )}
                <p className="ds-field-hint">
                    {isFound
                        ? 'Anything that would only be obvious to the real owner — this is your best fraud check.'
                        : 'Tap an idea to add it, or type your own. Don\'t include passwords, PINs or ID numbers.'}
                </p>
                {cat?.privacyNote && <p className="ds-field-hint irf-note">{cat.privacyNote}</p>}
            </div>

            {attrs.length > 0 && (
                <div className="ds-field">
                    <label>Specs &amp; extras <span className="ds-field-hint" style={{ display: 'inline', fontWeight: 400 }}>— optional, but each one you fill in sharpens the match</span></label>
                    <div className="ds-form-row ds-form-row-2">
                        {attrs.map((a) => (
                            <div className="ds-field" key={a.key}>
                                <label htmlFor={`detail_${a.key}`} style={{ fontWeight: 600, fontSize: 13 }}>{a.label}</label>
                                <ComboBox id={`detail_${a.key}`} name={`detail_${a.key}`} value={form.details?.[a.key] || ''}
                                    onChange={(v) => set((p) => ({ ...p, details: { ...(p.details || {}), [a.key]: v } }))}
                                    options={a.options} placeholder="Pick or type" maxLength={80} />
                                {a.hint && <p className="ds-field-hint">{a.hint}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="ds-form-row ds-form-row-2">
                <div className="ds-field">
                    <label htmlFor={placeField}>{isFound ? 'Location Found' : 'Location Lost'}</label>
                    <ComboBox id={placeField} name={placeField} value={form[placeField]} maxLength={255}
                        onChange={setField(placeField)} options={places}
                        placeholder="Pick a place or type the exact spot" />
                    <p className="ds-field-hint">
                        {cat?.places?.length ? `Places where “${cat.name}” usually turn up are listed first. ` : ''}
                        Add the room or landmark if you can (e.g. “Library, 2nd floor”).
                    </p>
                </div>
                <div className="ds-field">
                    <label htmlFor={dateField}>{isFound ? 'Date Found' : 'Date Lost'}</label>
                    <input id={dateField} type="date" name={dateField} value={form[dateField]} max={today}
                        onChange={(e) => set((p) => ({ ...p, [dateField]: e.target.value }), dateField)} />
                    <div className="irf-chips">
                        <button type="button" className="irf-chip" onClick={() => set((p) => ({ ...p, [dateField]: today }), dateField)}>Today</button>
                        <button type="button" className="irf-chip" onClick={() => set((p) => ({ ...p, [dateField]: yesterday }), dateField)}>Yesterday</button>
                    </div>
                    <p className="ds-field-hint">
                        {isFound ? 'Today\'s date, or when you actually found it if that was earlier.' : 'An approximate date is fine if you\'re not sure of the exact day.'}
                    </p>
                </div>
            </div>

            <LiveMatchPreview kind={kind} form={form} showBrand={showBrand} showModel={showModel} hasDetails={attrs.length > 0} />
        </>
    );
}
