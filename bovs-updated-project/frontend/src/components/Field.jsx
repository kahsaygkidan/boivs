export default function Field({ label, required, children }) {
  return (
    <div className="form-field">
      <label>
        {label}
        {required && <> <span className="req">*</span></>}
      </label>
      {children}
    </div>
  );
}
