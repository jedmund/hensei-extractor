<script lang="ts">
  import { Label } from 'bits-ui'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props extends Omit<HTMLInputAttributes, 'size'> {
    variant?: 'default' | 'contained'
    contained?: boolean
    size?: 'small' | 'medium' | 'large'
    error?: string
    label?: string
    leftIcon?: string
    rightIcon?: string
    leftAccessory?: Snippet
    rightAccessory?: Snippet
    clearable?: boolean
    onClear?: () => void
    counter?: number
    maxLength?: number
    hidden?: boolean
    fullWidth?: boolean
    fullHeight?: boolean
    alignRight?: boolean
    no1password?: boolean
    handleBlur?: () => void
    handleFocus?: () => void
    handleInput?: () => void
  }

  let {
    variant = 'default',
    contained = false,
    size = 'medium',
    error,
    label,
    leftIcon,
    rightIcon,
    leftAccessory,
    rightAccessory,
    clearable = false,
    onClear,
    counter,
    maxLength,
    hidden = false,
    fullWidth = false,
    fullHeight = false,
    alignRight = false,
    value = $bindable(),
    type = 'text',
    placeholder,
    disabled = false,
    readonly = false,
    required = false,
    class: className = '',
    no1password = false,
    handleBlur,
    handleFocus,
    handleInput,
    ...restProps
  }: Props = $props()

  const currentCount = $derived(String(value ?? '').length)
  const charsRemaining = $derived(maxLength !== undefined ? maxLength - currentCount : undefined)
  const showCounter = $derived(
    counter !== undefined || (charsRemaining !== undefined && charsRemaining <= 5)
  )
  const hasWrapper = $derived(
    leftIcon || rightIcon || leftAccessory || rightAccessory || clearable || maxLength !== undefined
  )

  function handleClear() {
    value = ''
    onClear?.()
  }

  function onFocusInternal(event: FocusEvent) {
    const input = event.currentTarget as HTMLInputElement
    input.select()
    handleFocus?.()
  }

  const fieldsetClasses = $derived(
    ['fieldset', hidden && 'hidden', fullWidth && 'full', className].filter(Boolean).join(' ')
  )

  const inputClasses = $derived(
    [
      'input',
      size,
      (variant === 'contained' || contained) && 'contained',
      alignRight && 'alignRight',
      fullHeight && 'fullHeight',
      hasWrapper && 'wrapper',
      className
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

<fieldset class={fieldsetClasses}>
  {#if label}
    <Label.Root class="label" for={restProps.id}>
      {label}
      {#if required}
        <span class="required">*</span>
      {/if}
    </Label.Root>
  {/if}

  {#if hasWrapper}
    <div class={inputClasses}>
      {#if leftIcon}
        <span class="iconLeft">
          <Icon name={leftIcon} size={14} />
        </span>
      {:else if leftAccessory}
        <span class="iconLeft">
          {@render leftAccessory()}
        </span>
      {/if}

      <input
        bind:value
        {type}
        {placeholder}
        {disabled}
        {readonly}
        {required}
        maxlength={maxLength}
        data-1p-ignore={no1password}
        onblur={handleBlur}
        onfocus={onFocusInternal}
        oninput={handleInput}
        {...restProps}
      />

      {#if rightIcon}
        <span class="iconRight">
          <Icon name={rightIcon} size={14} />
        </span>
      {:else if rightAccessory}
        <span class="iconRight">
          {@render rightAccessory()}
        </span>
      {/if}

      {#if clearable && value}
        <button type="button" class="clearButton" onclick={handleClear}>
          <Icon name="close" size={14} />
        </button>
      {/if}

      {#if showCounter}
        <span class="counter" class:warning={charsRemaining !== undefined && charsRemaining <= 5}>
          {charsRemaining !== undefined ? charsRemaining : currentCount}
        </span>
      {/if}
    </div>
  {:else}
    <input
      bind:value
      class={inputClasses}
      {type}
      {placeholder}
      {disabled}
      {readonly}
      {required}
      maxlength={maxLength}
      data-1p-ignore={no1password}
      onblur={handleBlur}
      onfocus={onFocusInternal}
      oninput={handleInput}
      {...restProps}
    />
  {/if}

  {#if error}
    <span class="error">{error}</span>
  {/if}
</fieldset>

<style lang="scss">
  @use 'themes/spacing' as *;
  @use 'themes/typography' as *;
  @use 'themes/layout' as *;
  @use 'themes/effects' as *;

  .fieldset {
    display: flex;
    flex-direction: column;
    gap: $unit-half;
    border: none;
    padding: 0;
    margin: 0;

    &:last-child .error {
      margin-bottom: 0;
    }

    &.hidden {
      display: none;
    }

    &.full {
      width: 100%;
    }

    :global(.label) {
      color: var(--color-text);
      font-size: $font-small;
      font-weight: $medium;
      margin-bottom: $unit-half;
    }

    :global(.label .required) {
      color: var(--color-error);
      margin-left: $unit-fourth;
      display: none;
    }

    .error {
      color: var(--color-error);
      font-size: $font-small;
      padding: $unit-half $unit-2x;
      min-width: 100%;
      margin-bottom: $unit;
      width: 0;
    }
  }

  .input {
    -webkit-font-smoothing: antialiased;
    background-color: var(--input-bg);
    border-radius: $input-corner;
    border: none;
    box-sizing: border-box;
    color: var(--color-text);
    display: block;
    font-family: var(--font-family, inherit);
    width: 100%;
    @include smooth-transition($duration-quick, background-color);

    &.fullHeight {
      height: 100%;
    }

    &.wrapper {
      align-items: center;
      background: var(--input-bg);
      border-radius: $input-corner;
      box-sizing: border-box;
      position: relative;
      display: flex;
      padding: 0;

      .counter {
        color: var(--color-text-tertiary);
        display: flex;
        align-items: center;
        font-weight: $normal;
        font-size: $font-small;
        position: absolute;
        right: $unit-2x;
        top: 0;
        bottom: 0;
        pointer-events: none;

        &.warning {
          background: var(--color-error);
          color: white;
          padding: 0 $unit-half;
          border-radius: $unit-half;
          top: 50%;
          bottom: auto;
          transform: translateY(-50%);
        }
      }

      input {
        background: transparent;
        border-radius: $input-corner;
        box-sizing: border-box;
        color: var(--color-text);
        width: 100%;
        font-family: inherit;
        border: 2px solid transparent;
        @include smooth-transition($duration-quick, border-color);
      }

      .iconLeft,
      .iconRight {
        position: absolute;
        display: flex;
        align-items: center;
        pointer-events: none;
        color: var(--color-text-secondary);

        :global(svg) {
          fill: currentColor;
        }
      }

      .iconLeft {
        left: $unit-2x;
      }

      .iconRight {
        right: $unit-2x;
      }

      .clearButton {
        position: absolute;
        right: $unit-2x;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: $unit-half;
        @include smooth-transition($duration-quick, background-color, color);

        &:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-text);
        }

        :global(svg) {
          fill: currentColor;
        }
      }
    }

    &[type='number']::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    &.contained {
      background-color: var(--input-bound-bg);

      &:hover:not(:disabled) {
        background-color: var(--input-bound-bg-hover);
      }

      &.wrapper {
        background-color: var(--input-bound-bg);

        &:hover:not(:has(input:disabled)) {
          background-color: var(--input-bound-bg-hover);
        }
      }
    }

    &.alignRight {
      text-align: right;
    }

    &:hover:not(:disabled):not(.contained) {
      background-color: var(--input-bg-hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.small {
      font-size: $font-small;
      min-height: $unit-3x;

      &:not(.wrapper) {
        padding: $unit-half $unit;
      }

      &.wrapper input {
        padding: $unit-half $unit;
        font-size: $font-small;
      }

      &:has(.iconLeft) input {
        padding-left: $unit-4x;
      }

      &:has(.iconRight) input,
      &:has(.clearButton) input {
        padding-right: $unit-4x;
      }

      &:has(.counter) input {
        padding-right: $unit-6x;
      }
    }

    &.medium {
      font-size: 1.6rem;
      min-height: $unit-4x;

      &:not(.wrapper) {
        padding: $unit calc($unit * 1.5);
      }

      &.wrapper input {
        padding: $unit calc($unit * 1.5);
        font-size: 1.6rem;
      }

      &:has(.iconLeft) input {
        padding-left: $unit-5x;
      }

      &:has(.iconRight) input,
      &:has(.clearButton) input {
        padding-right: $unit-5x;
      }

      &:has(.counter) input {
        padding-right: $unit-8x;
      }
    }

    &.large {
      font-size: $font-large;
      min-height: calc($unit * 6);

      &:not(.wrapper) {
        padding: $unit-2x $unit-3x;
      }

      &.wrapper input {
        padding: $unit-2x $unit-3x;
        font-size: $font-large;
      }

      &:has(.iconLeft) input {
        padding-left: $unit-6x;
      }

      &:has(.iconRight) input,
      &:has(.clearButton) input {
        padding-right: $unit-6x;
      }

      &:has(.counter) input {
        padding-right: $unit-10x;
      }
    }
  }

  input.input {
    -webkit-font-smoothing: antialiased;
    background-color: var(--input-bg);
    border-radius: $input-corner;
    border: 2px solid transparent;
    box-sizing: border-box;
    color: var(--color-text);
    display: block;
    font-family: var(--font-family, inherit);
    width: 100%;
    @include smooth-transition($duration-quick, background-color);

    &[type='number']::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }

    &.contained {
      background-color: var(--input-bound-bg);

      &:hover:not(:disabled) {
        background-color: var(--input-bound-bg-hover);
      }
    }

    &.alignRight {
      text-align: right;
    }

    &.fullHeight {
      height: 100%;
    }

    &:hover:not(:disabled):not(.contained) {
      background-color: var(--input-bg-hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &.small {
      padding: $unit-half $unit;
      font-size: $font-small;
      min-height: $unit-3x;
    }

    &.medium {
      padding: $unit calc($unit * 1.5);
      font-size: 1.6rem;
      min-height: $unit-4x;
    }

    &.large {
      padding: $unit-2x $unit-3x;
      font-size: $font-large;
      min-height: calc($unit * 6);
    }
  }

  .input::placeholder,
  .input > input::placeholder,
  input.input::placeholder {
    color: var(--color-text-tertiary);
    opacity: 1;
  }
</style>
