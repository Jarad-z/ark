"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescriptorNotFoundError = exports.ValidationError = exports.StepExecutionError = exports.PortBindingError = exports.ArkError = void 0;
class ArkError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'ArkError';
    }
}
exports.ArkError = ArkError;
class PortBindingError extends ArkError {
    constructor(message) {
        super(message, 'PORT_BINDING_ERROR');
        this.name = 'PortBindingError';
    }
}
exports.PortBindingError = PortBindingError;
class StepExecutionError extends ArkError {
    stepId;
    cause;
    constructor(message, stepId, cause) {
        super(message, 'STEP_EXECUTION_ERROR');
        this.stepId = stepId;
        this.cause = cause;
        this.name = 'StepExecutionError';
    }
}
exports.StepExecutionError = StepExecutionError;
class ValidationError extends ArkError {
    issues;
    constructor(message, issues) {
        super(message, 'VALIDATION_ERROR');
        this.issues = issues;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class DescriptorNotFoundError extends ArkError {
    constructor(id) {
        super(`CLI descriptor not found: ${id}`, 'DESCRIPTOR_NOT_FOUND');
        this.name = 'DescriptorNotFoundError';
    }
}
exports.DescriptorNotFoundError = DescriptorNotFoundError;
//# sourceMappingURL=errors.js.map