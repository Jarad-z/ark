export class ArkError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'ArkError'
  }
}

export class PortBindingError extends ArkError {
  constructor(message: string) {
    super(message, 'PORT_BINDING_ERROR')
    this.name = 'PortBindingError'
  }
}

export class StepExecutionError extends ArkError {
  constructor(
    message: string,
    public readonly stepId: string,
    public readonly cause?: unknown
  ) {
    super(message, 'STEP_EXECUTION_ERROR')
    this.name = 'StepExecutionError'
  }
}

export class ValidationError extends ArkError {
  constructor(
    message: string,
    public readonly issues: string[]
  ) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class DescriptorNotFoundError extends ArkError {
  constructor(id: string) {
    super(`CLI descriptor not found: ${id}`, 'DESCRIPTOR_NOT_FOUND')
    this.name = 'DescriptorNotFoundError'
  }
}
