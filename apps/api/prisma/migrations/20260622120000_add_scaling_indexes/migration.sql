-- CreateIndex
CREATE INDEX "Employee_tenantId_status_firstName_id_idx" ON "Employee"("tenantId", "status", "firstName", "id");

-- CreateIndex
CREATE INDEX "Employee_companyId_status_firstName_id_idx" ON "Employee"("companyId", "status", "firstName", "id");

-- CreateIndex
CREATE INDEX "Employee_tenantId_documentNumber_idx" ON "Employee"("tenantId", "documentNumber");

-- CreateIndex
CREATE INDEX "Employee_tenantId_employeeCode_idx" ON "Employee"("tenantId", "employeeCode");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_status_workDate_idx" ON "AttendanceRecord"("tenantId", "status", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceRecord_companyId_status_workDate_idx" ON "AttendanceRecord"("companyId", "status", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceRecord_tenantId_employeeId_workDate_idx" ON "AttendanceRecord"("tenantId", "employeeId", "workDate");

-- CreateIndex
CREATE INDEX "EmployeeRequest_tenantId_createdAt_id_idx" ON "EmployeeRequest"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeRequest_companyId_createdAt_id_idx" ON "EmployeeRequest"("companyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeRequest_tenantId_status_createdAt_id_idx" ON "EmployeeRequest"("tenantId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeRequest_companyId_status_createdAt_id_idx" ON "EmployeeRequest"("companyId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_createdAt_id_idx" ON "EmployeeDocument"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_createdAt_id_idx" ON "EmployeeDocument"("companyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_status_createdAt_id_idx" ON "EmployeeDocument"("tenantId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_status_createdAt_id_idx" ON "EmployeeDocument"("companyId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_tenantId_expiresAt_createdAt_id_idx" ON "EmployeeDocument"("tenantId", "expiresAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "EmployeeDocument_companyId_expiresAt_createdAt_id_idx" ON "EmployeeDocument"("companyId", "expiresAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_id_idx" ON "AuditLog"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_createdAt_id_idx" ON "AuditLog"("companyId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Notification_tenantId_status_priority_generatedAt_id_idx" ON "Notification"("tenantId", "status", "priority", "generatedAt", "id");

-- CreateIndex
CREATE INDEX "Notification_companyId_status_priority_generatedAt_id_idx" ON "Notification"("companyId", "status", "priority", "generatedAt", "id");

-- CreateIndex
CREATE INDEX "Notification_tenantId_generatedAt_id_idx" ON "Notification"("tenantId", "generatedAt", "id");

-- CreateIndex
CREATE INDEX "Notification_companyId_generatedAt_id_idx" ON "Notification"("companyId", "generatedAt", "id");
