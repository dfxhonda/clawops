-- T3d-audit_log-coverage-check: machines / staff / machine_models / suppliers に audit_log trigger追加
CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON machines
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON machine_models
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();

CREATE TRIGGER trg_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION log_to_audit_log();
