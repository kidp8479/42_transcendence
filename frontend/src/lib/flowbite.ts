export const darkTextInputTheme = {
  field: {
    input: {
      colors: {
        gray: "border-control-border bg-control-bg text-text-primary placeholder:text-control-placeholder focus:border-brand-500 focus:ring-brand-500",
        failure:
          "!border-control-error !bg-control-bg text-text-primary placeholder:!text-control-placeholder focus:!border-control-error focus:!bg-control-bg focus:!ring-control-error",
      },
    },
  },
};

export const darkAlertTheme = {
  color: {
    failure: "border !border-control-error !bg-alert-bg !text-control-error",
  },
  icon: "mr-3 inline h-5 w-5 shrink-0 text-control-error",
};
