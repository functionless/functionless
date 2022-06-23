/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved */
import { useColorMode } from "@docusaurus/theme-common";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Container from "@mui/material/Container";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LogoDark from "@site/static/img/Logo-dark.svg";
import Logo from "@site/static/img/Logo.svg";
import Layout from "@theme/Layout";
import { useMemo, useState } from "react";
import { Controller, useForm, Control } from "react-hook-form";
import { FunctionlessHighlighter } from "../components/highlighter";

// https://legacydocs.hubspot.com/docs/methods/forms/submit_form
interface HubSpotFormSubmission {
  // This millisecond timestamp is optional. Update the value from "1517927174000" to avoid an INVALID_TIMESTAMP error
  submittedAt?: string;
  fields: {
    objectTypeId: string;
    name: string;
    value: string;
  }[];
  context?: {
    // include this parameter and set it to the hubspotutk cookie value to enable cookie tracking on your submission
    hutk?: string;
    pageUri?: string;
    pageName?: string;
  };
  legalConsentOptions?: {
    consent: {
      // Include this object when GDPR options are enabled
      consentToProcess: boolean;
      text: string;
      communications: {
        value: boolean;
        subscriptionTypeId: number;
        text: string;
      }[];
    };
  };
}

enum HubSpotTypeId {
  SingleLineText = "0-1",
}

const submit = async (formData: FormData) => {
  // field names that match the hub spot form field names
  const { email, company } = formData;
  const fields = {
    email,
    company,
    firstname: formData.firstName,
    lastname: formData.lastName,
    company_size: formData.companySize,
    jobtitle: formData.role,
    // https://legacydocs.hubspot.com/docs/faq/how-do-i-set-multiple-values-for-checkbox-properties
    iac_experience: (formData.iac ?? []).join(";"),
    iac_other: formData.iacOther,
  };
  await fetch(
    "https://api.hsforms.com/submissions/v3/integration/submit/22084824/9e8475ef-7968-4cdf-ab9d-cf1377216fef",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.entries(fields)
          .filter(([_, value]) => typeof value !== "undefined")
          .map(([key, value]) => ({
            name: key,
            value,
            objectTypeId: HubSpotTypeId.SingleLineText,
          })),
        context: {
          pageName: "Sign Up",
          pageUri: location.href,
        },
      } as HubSpotFormSubmission),
    }
  );
};

export default function FormPage() {
  return (
    <Layout>
      <Themed />
    </Layout>
  );
}

function Themed() {
  const { colorMode } = useColorMode();

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: colorMode,
        },
      }),
    [colorMode]
  );

  return (
    <ThemeProvider theme={theme}>
      <Form />
    </ThemeProvider>
  );
}

const InitialForm = (props: { control: Control<FormData, any> }) => {
  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="firstName"
            control={props.control}
            render={({ field }) => (
              <TextField
                {...field}
                autoComplete="given-name"
                required
                fullWidth
                label="First Name"
                autoFocus
              />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Controller
            name="lastName"
            control={props.control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                fullWidth
                label="Last Name"
                autoComplete="family-name"
              />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <Controller
            name="email"
            control={props.control}
            render={({ field }) => (
              <TextField
                {...field}
                required
                fullWidth
                label="Email Address"
                autoComplete="email"
              />
            )}
          />
        </Grid>
      </Grid>
      <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
        Submit
      </Button>
    </>
  );
};

const SecondForm = (props: { control: Control<FormData, any> }) => {
  const [iacOtherSelected, setIacOtherSelected] = useState<boolean>(false);
  return (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Controller
            name="company"
            control={props.control}
            render={({ field }) => (
              <TextField {...field} fullWidth label="Company name" autoFocus />
            )}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Controller
            name="role"
            control={props.control}
            render={({ field }) => (
              <TextField {...field} fullWidth label="Job Title" />
            )}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl>
            <FormLabel id="demo-radio-buttons-group-label">
              Company Size
            </FormLabel>
            <Controller
              name="companySize"
              control={props.control}
              render={({ field }) => (
                <RadioGroup {...field}>
                  {Object.entries(CompanySizes).map(([key, label]) => (
                    <FormControlLabel
                      value={key}
                      control={<Radio />}
                      label={label}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <FormGroup>
            <Controller
              name="iac"
              control={props.control}
              render={({ field }) => (
                <>
                  {Object.entries(IaCOptions).map(([key, label]) => (
                    <FormControlLabel
                      {...field}
                      key={key}
                      label={label}
                      control={
                        <Checkbox
                          onChange={() => {
                            const items = !field?.value?.includes(key as any)
                              ? [...(field.value ?? []), key]
                              : field.value.filter((topic) => topic !== key);

                            setIacOtherSelected(
                              items.includes("Something Else")
                            );

                            field.onChange(items);
                          }}
                        />
                      }
                    />
                  ))}
                </>
              )}
            />{" "}
          </FormGroup>
          {iacOtherSelected ? (
            <Controller
              name="iacOther"
              control={props.control}
              render={({ field }) => (
                <TextField {...field} fullWidth label="Other IaC" />
              )}
            />
          ) : undefined}
        </Grid>
      </Grid>
      <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
        Submit
      </Button>
    </>
  );
};

const Confirmation = () => {
  return (
    <Paper elevation={2} sx={{ padding: 3 }}>
      Thank you for your interest in Functionless. Expect updates soon.
    </Paper>
  );
};

interface InitialFormData {
  firstName: string;
  lastName: string;
  email: string;
}

// Hubspot internal value -> label
const IaCOptions = {
  "Azure Resource Manager": "Azure Resource Manager",
  "CDK (Cloud Development Kit)": "CDK (Cloud Development Kit)",
  CloudFormation: "CloudFormation",
  Pulumi: "Pulumi",
  "Serverless Stack": "Serverless Stack",
  Terraform: "Terraform",
  "Terraform CDK": "Terraform CDK",
  None: "None",
  "Something Else": "Other",
} as const;

type IaC = keyof typeof IaCOptions;

// Hubspot internal value -> label
const CompanySizes = {
  "1": "1",
  "2": "2-5",
  "6": "6-30",
  "31": "31-99",
  "100": "100+",
} as const;

type CompanySize = keyof typeof CompanySizes;

interface FormData extends InitialFormData {
  company?: string;
  companySize?: CompanySize;
  iac?: IaC[];
  role?: string;
  iacOther?: string;
}

const Form = () => {
  const [formState, setFormState] = useState<"initial" | "second" | "complete">(
    "initial"
  );
  const [initialFormData, setFormData] = useState<
    InitialFormData | undefined
  >();
  const { control, handleSubmit } = useForm<FormData>();

  const innerSubmit = (
    formData: FormData,
    event?: React.BaseSyntheticEvent
  ) => {
    event?.preventDefault();

    if (formState === "initial") {
      submit(formData).catch(() => {});

      setFormData(formData);
      setFormState("second");
    } else if (formState === "second") {
      submit({
        ...formData,
        ...initialFormData!,
      }).catch(() => {});

      setFormState("complete");
    }
  };

  const { colorMode } = useColorMode();

  return (
    <Container component="main" maxWidth="xl">
      <Box
        sx={{
          alignItems: "center",
          marginTop: 2,
          display: "flex",
          flexDirection: "column",
        }}
      ></Box>
      <Grid container>
        <Grid container>
          <Grid item md={4} xs={12}>
            <Box
              sx={{
                alignItems: "center",
                marginTop: { md: 9, xs: 1 },
                margin: { md: 4, xs: 1 },
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography component="h1" variant="h5">
                Receive updates on Functionless.
              </Typography>
            </Box>
          </Grid>
          <Grid item md={6} sx={{ display: { xs: "none", md: "block" } }}>
            <Box
              sx={{
                alignItems: "center",
                marginTop: 8,
                margin: 4,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Typography component="h1" variant="h5">
                Write your application and infrastructure code together with
                Functionless
              </Typography>
            </Box>
          </Grid>
          <Grid item md={2} sx={{ display: { xs: "none", md: "block" } }}>
            {colorMode === "dark" ? <LogoDark /> : <Logo />}
          </Grid>
        </Grid>
        <Grid item md={4} xs={12}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Box
              component="form"
              noValidate
              onSubmit={handleSubmit(innerSubmit)}
              sx={{ mt: 4 }}
            >
              {formState === "initial" ? (
                <InitialForm control={control} />
              ) : formState === "second" ? (
                <SecondForm control={control} />
              ) : (
                <Confirmation />
              )}
            </Box>
          </Box>
        </Grid>
        <Grid item md={8} sx={{ display: { xs: "none", md: "block" } }}>
          <Box
            sx={{
              alignItems: "left",
              margin: 4,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <FunctionlessHighlighter>
              {`const bus = new EventBus<Event<{ name: string }>>(this, 'bus');

const validateName = new Function<string, boolean>(this, 'validateName', async (name) => {
  const result = await fetch(\`http://my.domain.com/validate/\${name}\`);
  return result.status === 200;
});

const sfn = new StepFunction(this, 'sfn', async (props: {name: string}) => {
  // if name is valid
  if(validateName(name)) {
    // send a notification to the event bus.
    await bus.putEvents({
      source: 'magicApplication',
      'detail-type': 'form-submit',
      detail: {
        name
      }
    });
  }
});

sfn.onFailed('failedRule').pipe(new Function(this, 'failedWorkflows', async (event) => {
  console.log(event);
});
`}
            </FunctionlessHighlighter>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};
